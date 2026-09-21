---
sidebar_position: 10
---

# End-to-end fleet testing

`peers-e2e` spawns many real `peers-headless` processes on one machine, wires
them into a device mesh over loopback, and drives each one through its RPC
socket. It exists to answer questions the unit suites cannot: does a row
written on one device reach the others, does a 32-device account respect the
connection caps, does a hub that dies come back, what happens during a network
partition.

Nothing in the product is mocked. Every device is a separate Node process with
its own SQLite database, real handshakes and signatures, real sync, and the
same `ws` protocol manager the headless host uses in production. The only
differences from a deployment are `--services-url none` (no cloud), loopback
addresses, and ephemeral ports.

## Layout

```
peers-e2e/
  src/harness/
    process.ts       HeadlessProcess: one child, its log file, stop/kill, READY payload
    device-handle.ts DeviceHandle: RPC socket per device (tables, tools, contracts, events, logs)
    fleet.ts         Fleet: users, devices, bootstrap waves, contacts/groups/pairing, faults, teardown
    topology.ts      bootstrap shapes (star, chain, ring, tree, random, custom) + cap validation
    wait.ts          waitUntil / waitForAll convergence helpers with per-device timings
    mesh-graph.ts    snapshot of who is connected to whom; invariants; Mermaid output
    proxy.ts         LoopbackProxy: sever / delay / block links in front of a device
    artifacts.ts     per-run directory, merged timeline, failure bundle
    reaper.ts        pidfiles so orphans can be killed after a crashed runner
  src/cli/peers-fleet.ts   detached fleets for interactive and agent use
  src/scenarios/*.e2e.test.ts
  artifacts/               gitignored run output
```

The package depends on built siblings: `peers-sdk`, `peers-device`,
`peers-core`, `peers-cli`, and `peers-headless`. Build those first (see
[Headless host](./Headless.md)); the harness fails fast with the same
`requireBuilt` messages the headless smoke tests use.

## Running

```bash
cd peers-e2e
npm test                 # Tier 0: unit tests, no processes
npm run e2e              # Tier 1: every scenario except fleet-large (<= 8 processes each)
npm run e2e:fleet        # Tier 2: PEERS_FLEET_SIZE=32
npm run e2e:fleet:large  # Tier 3: PEERS_FLEET_SIZE=100
```

| Tier | Processes | What it proves | Typical time |
|---|---|---|---|
| 0 | none | topology builders and cap checks, wait helpers, proxy, handle serialization | seconds |
| 1 | ≤ 8 per file | single device, same-user sync, discovery, contacts + group, pairing, resilience, faults, connection cap with a small `maxConnections`, packages and contracts across a group | ~3 min |
| 2 | 32 | own-device cap (≤ 8 dials, ≤ 30 connections), hub pruning, tree of 32 with contacts and a group, sync latency percentiles | ~2–3 min |
| 3 | 100 | 10 users × 10 devices: connected within caps, per-user convergence within budget, resource report | ~1–2 min |

Tier 3 needs roughly 13 GB of RSS (about 130 MB per device) and spawns in
waves; it is meant for a workstation or a nightly job, not a default CI runner.
The pre-flight budget check warns when free memory or `ulimit -n` look too small
(macOS under-reports free memory, so the warning there is usually noise; pass
`failOnBudget: true` to make it fatal).

### When to run which tier

- **Tier 0/1** after touching `peers-sdk` sync or connection code, `peers-device`,
  `peers-headless`, `peers-e2e`, or an official package. The scenarios in Tier 1
  need `official-packages/isolation-smoke` and `isolation-consumer` built
  (`npm run build` in each).
- **Tier 2** when touching `connection-manager*`, `network-manager`, `sync-group`,
  `websocket-client`, or device election: the 32-device cap scenario is where
  shedding and redial policy show their real behaviour. Compare
  `sync-latency-same-user.json` before and after.
- **Tier 3** on a workstation or nightly, not per change.

`full-release.js` runs Tier 0 and Tier 1 (plus the `peers-headless` unit and
smoke tests) as Step 2b before anything is versioned or published, and aborts
the release on failure. After `peers-services` is pushed it also waits for the
Azure deploy workflow to succeed before releasing the desktop client. `--skip-e2e`
and `--skip-services-deploy` bypass those gates for an emergency release and say
so loudly. The e2e packages are deliberately not wired into CI. See
[Releasing](./Releasing.md).

### Environment flags

| Variable | Effect |
|---|---|
| `PEERS_FLEET_SIZE` | Enables the Tier 2/3 scenarios in `fleet-large.e2e.test.ts` (`32` or `100`). |
| `PEERS_FLEET_CONCURRENCY` | Concurrent spawns (default `min(8, cpus)`). |
| `PEERS_HARNESS_DEBUG=1` | Mirror every child's stdout/stderr to the test's stderr. |
| `PEERS_HARNESS_KEEP=1` | Keep the artifact directory (and on-disk databases) after a passing run. |
| `PEERS_E2E_ARTIFACTS` | Artifact root (default `peers-e2e/artifacts`). |
| `PEERS_FLEET_HOME` | State directory for `peers-fleet` (default `~/peers/fleet`). |

## Writing a scenario

```ts
import { type Fleet, startFleet } from "@peers-app/peers-e2e";

let fleet: Fleet;
beforeAll(async () => {
  fleet = await startFleet({ name: "my-scenario" });
});
afterAll(() => fleet?.stop());

it("a row written on one device reaches the others", async () => {
  const alice = await fleet.user({ name: "Alice", devices: 3, bootstrap: "star" });
  const bob = await fleet.user({ name: "Bob" });
  await fleet.connectContacts(alice, bob);          // invite on one handle, accept on the other
  const group = await fleet.createGroup(alice, [bob]);
  await fleet.waitForMesh({ connected: true, perContext: true });

  const probe = await fleet.writeProbeRow(alice.devices[0]);
  const result = await fleet.waitForRow(alice.devices, probe.table, probe.filter);
  expect(result.p95Ms).toBeLessThan(10_000);       // per-device arrival timings

  const graph = await fleet.snapshotMesh("after-sync"); // mesh-after-sync.json + .mmd
  expect(graph.capViolations()).toEqual([]);
});
```

### Fleet

- `fleet.user({ name, devices, bootstrap, persistent, pairing, proxied })` creates an
  identity and spawns its devices in topological waves so every `--peer` target
  is READY before its dialers start. The first device is `--new-user`; the rest
  share a fleet-private credentials file. Users after the first bootstrap to the
  fleet's first device (`hub: "none"` to disable).
- `fleet.addDevice(user, { peers, persistent, noPeer, pairing, proxied })` adds one more.
- `fleet.connectContacts(a, b)`, `fleet.createGroup(founder, members, { role })`
  drive the invite contracts on the devices' handles, exactly as the UI does
  (`role` defaults to Reader; pass `GroupMemberRole.Writer` when a scenario
  needs remote tool access).
- `fleet.pairDevice(source)` spawns a `--pair` child against an in-process
  rendezvous and approves it from `source`.
- `fleet.waitForMesh({ connected, minDegree, perContext, stableFor })`,
  `fleet.meshGraph()`, `fleet.snapshotMesh(name)`. `stableFor: n` requires the
  invariants to hold on `n` consecutive polls, which matters right after a
  burst of dials at a device's cap: a single passing sample can be a mirage.
- `fleet.writeProbeRow(device)`, `fleet.waitForRow(devices, table, filter)`
  returns `{ timings, p50Ms, p95Ms, maxMs }`. Sync only travels over direct
  edges that share a data context, so assert `perContext` connectivity before
  asserting convergence.
- `fleet.installOfficialPackage(device, name, { dataContextId })` imports a
  built `official-packages/<name>` through the host's `addOrUpdatePackage` RPC
  (the same path as `peers packages add`); `fleet.waitForPackage(devices,
  packageId, dataContextId, { probe })` waits until the `Packages` and
  `PackageVersions` rows have arrived and, with `probe`, a local contract tool
  call succeeds on each device, which proves the bundle was downloaded and the
  isolated worker booted. `PEERS_OFFICIAL_PACKAGES_DIR` overrides the default
  `<monorepo>/official-packages`.
- `fleet.resourceReport()` (RSS per child), `fleet.describe()`, `fleet.stop()`.

`startFleet({ maxConnections })` starts every device with
`--max-connections <n>` and makes `MeshGraph.capViolations()` judge against the
same cap, so at-capacity shedding can be reproduced with a handful of processes
(`cap.e2e.test.ts`: seven devices, cap four).

Timeouts scale with fleet size: `scaledTimeoutMs(n)` is `base + perDevice × n`.

### Devices

`FleetDevice` wraps one process and its `DeviceHandle`:

- `device.handle.table(dataContextId, "Tasks").list(filter)` / `.get` / `.save`
- `device.handle.query(sql)`, `device.handle.runTool(name, args)`
- `device.handle.contract(definition, { dataContextId })` for invites, groups, pairing,
  and any installed package's contract (tools, tables, observables)
- `device.handle.remoteContract(definition, { dataContextId }).device(peerId).tools.x()`
  runs a contract tool on another device; the host forwards the call over the
  mesh and the target authorizes it (same account, or a group member meeting
  the tool's `remoteAccessLevel`). `packages.e2e.test.ts` exercises the
  same-account, cross-account, and denied paths.
- `device.handle.installPackage(input, { dataContextId, packageLocation })` calls
  the host's `addOrUpdatePackage` RPC directly
- `device.handle.onEvents(prefix, handler)`, `device.handle.waitForEvent(...)`
- `device.handle.logs({ sinceMs, level, textSearch })` reads `ConsoleLogs`
- `device.handle.connectedDevices()`, `verifiedPeers()`, `waitForPeer(deviceId)`
- `device.handle.cli(["db", "tables"])` runs the real CLI against this device
- `device.stop()` (SIGTERM), `device.kill()` (SIGKILL), `device.restart()` for
  `persistent` devices (same identity, device id, database, and listener port)

### Faults

Everything is applied from outside the product.

- Crashes: `device.kill()`, then `device.restart()`. Spokes re-dial their
  bootstrap URL on the peer client's 15 s rescan.
- Links: start devices `proxied: true` (fleet-wide or per device) and every
  connection *to* that device passes through a `LoopbackProxy`. The device
  advertises the proxy via `--advertise-url`, so discovered dials use it too.
  - `device.partition()` / `device.heal()` cut and restore all inbound
    connections; `device.setLatencyMs(ms)` adds one-way latency per chunk.
  - `fleet.partition(sideA, sideB)` splits the fleet into two groups that stay
    internally connected: each proxy refuses connections from the processes on
    the other side (identified with `lsof`) and drops the open ones.
    `fleet.healPartition()` clears the blocks; peers re-dial on their own
    schedule. `faults.e2e.test.ts` uses this for a split-brain write on both
    sides followed by a merge.

Severing a single device's proxy is not a full isolation of that device: its
own outbound dials to other proxies still work. Use `fleet.partition` when the
direction matters.

## Artifacts

Each run writes `artifacts/<name>-<timestamp>/`:

| File | Content |
|---|---|
| `fleet.json` | Users, devices, ports, pids, auth files, spawn specs, proxy state |
| `devices/<label>.log` | Timestamped stdout/stderr of every child (`O`, `E`, `#` spawn, `X` exit) |
| `timeline.log` | All device logs merged and sorted, `[label]`-prefixed |
| `mesh-<name>.json` / `.mmd` | Mesh snapshots taken with `snapshotMesh` (Mermaid renders in most viewers) |
| `sync-latency-*.json` | Convergence percentiles written by the scale scenarios |
| `resources.json` | RSS per child at stop |
| `failure/` | On a failed test: final mesh, last 200 `ConsoleLogs` rows per device, summary |

On success the directory is deleted unless `PEERS_HARNESS_KEEP=1` or the fleet
was started with `keepArtifacts: true` (the scale scenarios do this because the
reports are the result). Every fleet also records its child pids in
`~/peers/fleet/pids/`; `npx peers-fleet reap` kills children left behind by a
crashed runner.

## `peers-fleet`: a fleet for you or an agent

Jest is the wrong tool when you want to poke at a mesh interactively or let an
agent iterate against it. `peers-fleet` stands up the same fleet detached and
hands back one auth file per device:

```bash
cd peers-e2e && npm run build
npx peers-fleet up --name dev --users 2 --devices 3 --bootstrap tree:2 --contacts --group
npx peers-fleet ls --name dev            # labels, user ids, device ids, ports, auth files
npx peers-fleet graph --mermaid          # current mesh
npx peers-fleet logs alice-2 -f          # tail one device
peers --auth-file ~/peers/fleet/dev/state/alice-2.auth.json db query "SELECT name FROM Users"
npx peers-fleet down --name dev          # SIGTERM everything (--purge removes state)
npx peers-fleet reap --all               # kill orphans from any run
```

State lives in `~/peers/fleet/<name>/` (`fleet.json` plus per-device auth files
and logs); `PEERS_FLEET_HOME` overrides it. `--persist` keeps on-disk databases
so devices can be restarted with the same identity. Proxied faults are not
available from the CLI: the proxies live in the process that created them.

## What is deliberately not covered

- Cloud discovery, mailbox, and the production pairing room need
  `peers-services` (Mongo); the fleet runs with `--services-url none` and an
  in-process pairing rendezvous.
- LAN scan (`--lan-scan` probes port 3333 across a /24) cannot be exercised on
  one host.
- WebRTC: headless has no sidecar; every edge is a WebSocket.
- Multi-host latency and NAT. The loopback proxy adds delay, not packet loss or
  NAT behaviour.
