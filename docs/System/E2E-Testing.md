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
same `ws` protocol manager the headless host uses in production. Devices that
opt in also run the real `peers-webrtc` sidecar and form `wrtc://` edges, and
fleets that opt in run the real `peers-services` (with an in-memory Mongo) so
pairing and the invite mailbox are exercised against the production server
code. The only differences from a deployment are loopback addresses, ephemeral
ports, and `--services-url none` on the scenarios that do not need the cloud.

## Layout

```
peers-e2e/
  src/harness/
    process.ts       HeadlessProcess: one child, its log file, stop/kill, READY payload
    device-handle.ts DeviceHandle: RPC socket per device (tables, tools, contracts, events, logs)
    fleet.ts         Fleet: users, devices, bootstrap waves, contacts/groups/pairing, faults, teardown
    services.ts      ServicesProcess: real peers-services child + MongoMemoryServer, restart, mailbox queries
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
`requireBuilt` messages the headless smoke tests use. The pairing and invites
scenarios additionally need `peers-services` built (`npm run build` there) and
a Mongo: by default `mongodb-memory-server` downloads a `mongod` binary on the
first run (network needed once, cached under `~/.cache/mongodb-binaries`);
set `PEERS_E2E_MONGO_URI` to use an existing server instead.

Run `node link-deps.js` from the monorepo root before those builds when using
local npm checkouts. Runtime packages share process-global SDK registries for
signing, RPC handlers, and isolated-package loading; nested physical SDK copies
do not share those registries. The release script performs this linking step
before its E2E gate.

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
| 1 | ≤ 8 per file | single device, same-user sync, discovery, contacts + group, resilience, faults, connection cap with a small `maxConnections`, packages and contracts across a group, offline package-history catch-up and upgrades, WebRTC sidecar (skipped without a `peers-webrtc` binary), pairing and invites against the real `peers-services` (skipped when it is not built or no Mongo can start) | ~4–5 min |
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
  (`npm run build` in each), and `webrtc.e2e.test.ts` needs a `peers-webrtc`
  binary (`cd peers-webrtc && make local`, requires Go); without one it prints
  a warning and skips rather than failing. `pairing.e2e.test.ts` and
  `invites-services.e2e.test.ts` need `peers-services/dist` and a Mongo and
  skip the same way; also run them after touching `peers-services`
  (`auth`, `mailbox`, `device-pairing`, `connection-*`), `peers-device`
  `invites/`, or `MailboxClient`.
- **Tier 2** when touching `connection-manager*`, `network-manager`, `sync-group`,
  `websocket-client`, or device election: the 32-device cap scenario is where
  shedding and redial policy show their real behaviour. Compare
  `sync-latency-same-user.json` before and after.
- **Tier 3** on a workstation or nightly, not per change.

`full-release.js` runs Tier 0 and Tier 1 (plus the `peers-headless` unit and
smoke tests) as Step 2b before anything is versioned or published, and aborts
the release on failure. It builds `isolation-smoke` and `isolation-consumer`
first so the packages scenario has bundles, without versioning or publishing
those packages. It runs `make local` in `peers-webrtc` so the
WebRTC scenario cannot silently skip on the release machine, and sets
`PEERS_E2E_REQUIRE_SERVICES=1` so the pairing and invites scenarios fail instead
of skipping when `peers-services` or Mongo is unavailable. After `peers-services` is pushed it also waits for the
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
| `PEERS_E2E_MONGO_URI` | Use this Mongo for `peers-services` instead of starting `mongodb-memory-server`. The server always uses the `peers-services` database, so rows from earlier runs remain; assertions are keyed by per-run user ids and are not affected. |
| `PEERS_E2E_REQUIRE_SERVICES=1` | Fail (rather than skip) the scenarios that need a real `peers-services`. Set by `full-release.js`. |
| `PEERS_SERVICES_DIR` | Location of the `peers-services` checkout (default: the monorepo sibling). |

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

- `fleet.user({ name, devices, bootstrap, persistent, services, proxied, webrtc })` creates an
  identity and spawns its devices in topological waves so every `--peer` target
  is READY before its dialers start. The first device is `--new-user`; the rest
  share a fleet-private credentials file. Users after the first bootstrap to the
  fleet's first device (`hub: "none"` to disable).
- `fleet.addDevice(user, { peers, persistent, noPeer, services, proxied, webrtc })` adds one more.
- `services: true` on a user or device starts it with
  `--services-url <fleet services> --register-services`, so it dials the
  fleet's `peers-services`, registers, and holds a mailbox token
  (`device.process.services` is `"registered"` or `"failed"`; `"off"` for every
  other device). `pairing: true` is an alias. The service itself is started on
  first use, or eagerly with `startFleet({ services: true })`; `fleet.services`
  exposes `url`, `userId`, `stop()` / `start()` (same port, simulating an
  outage), and `mailboxCount(userId)` which reads the Mongo `mailbox`
  collection directly. `fleet.waitForServices(device)` resolves once the
  device's connection to the service is verified, which is the moment
  cross-user relays and queued-send retries become possible.
- `webrtc` is off by default: every device is started with `--no-webrtc`, so
  the 32- and 100-device fleets never spawn a Go process per device and every
  edge stays a WebSocket. `webrtc: true` auto-detects the sibling
  `peers-webrtc` build; a string is passed through as `--webrtc-sidecar <path>`
  (a nonexistent path or `/usr/bin/false` are how the failure modes are
  exercised). `device.process.webrtc` is the state the child reported at READY.
- `fleet.connectContacts(a, b)`, `fleet.createGroup(founder, members, { role })`
  drive the invite contracts on the devices' handles, exactly as the UI does
  (`role` defaults to Reader; pass `GroupMemberRole.Writer` when a scenario
  needs remote tool access).
- `fleet.pairDevice(source)` spawns a `--pair` child against the fleet's real
  `peers-services` pairing namespace and approves it from `source` (which must
  have been started `services: true`).
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
- `package-lifecycle.e2e.test.ts` makes a fleet-private copy of the built
  `isolation-smoke` artifact and emits schema-v4/v5/v6 versions without
  modifying the official checkout. Its offline follower receives v4 and v5
  across separate sync pages after the schema-v5 `TableDefinitions` pre-pass,
  caches both bundles, and activates only v5 after the watermark is durable.
  It then follows a stable v6 upgrade and proves the selected version survives
  a process restart. Reading the historical v4 bundle while the devices are
  partitioned verifies eager all-version bundle caching rather than an
  on-demand fetch.
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

## Pairing and invites against the real service

`pairing.e2e.test.ts` and `invites-services.e2e.test.ts` are the only
scenarios that run `peers-services`. The service is the production
`dist/server.js` started with `PORT=0`, a fresh identity, a per-run Mongo, and
the test-fleet env vars documented in the `peers-services` README (no dial to
`peers.app`, advertises only `127.0.0.1`). `invites-services` runs with
`hub: "none"`, so Alice and Bob have no direct edge and every path between
them goes through the service:

| Test | What it pins down |
|---|---|
| inviter offline | Bob accepts a token while Alice's device is stopped: the reply lands in Alice's mailbox (`mailboxCount === 1`, row `deliveryState: "sent"`); Alice's restart drains it (`InviteService.start` calls `syncMailbox`) and acks it (`mailboxCount === 0`). |
| invitee offline | Alice `inviteContactToGroup` while Bob is stopped; on restart Bob gets a pending inbound `Invites` row, accepts, and can read the group context (`GroupMembers` seeded from the approval, which carried the group secret). |
| services down | With the service stopped the row is `queued`; after `fleet.services.start()` the host's reconnect hook (or the Invites `syncMailbox` tool) flips it to `sent` and the message is in Bob's mailbox. |
| both online | Two users with no direct edge: the reply is relayed over the service's `user:<id>` route and never touches the mailbox. If this test starts failing with a mailbox count of one, the relay stopped delivering and the fallback to store-and-forward kicked in. |

`mailboxCount` runs its query in a child `node` process rather than in the Jest
VM: inside Jest the Mongo driver's handshake serializes without its `driver`
sub-document and the server rejects the connection.

## What is deliberately not covered

- Cloud discovery beyond the single test service, TURN credentials, and Azure
  specifics (the fleet's `peers-services` has no `.env`, no API keys, and no
  peer servers).
- LAN scan (`--lan-scan` probes port 3333 across a /24) cannot be exercised on
  one host.
- WebRTC beyond loopback. `webrtc.e2e.test.ts` puts two sidecar devices with no
  listener (`noPeer`) behind a WebSocket-only hub and asserts a direct
  `wrtc://` edge forms and syncs a row, that a missing binary degrades to
  WebSocket-only, and that a sidecar which exits immediately hits the restart
  cap without taking the host down. Both sidecar devices discover each other
  through the hub and dial at once; `WebRTCSidecar` keeps the offer from the
  smaller `deviceId` so the edge forms instead of both sides abandoning their
  own offer. That covers signaling over the mesh and the datachannel state
  machine; it says nothing about STUN/TURN, NAT traversal, or the TURN
  credentials `peers.app` hands out. Every other scenario runs `--no-webrtc`.
- Multi-host latency and NAT. The loopback proxy adds delay, not packet loss or
  NAT behaviour.
