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

The Peers hosts run real product code. Every device is a separate Node process with
its own SQLite database, real handshakes and signatures, real sync, and the
same `ws` protocol manager the headless host uses in production. Devices that
opt in also run the real `peers-webrtc` sidecar and form `wrtc://` edges, and
fleets that opt in run the real `peers-services` (with an in-memory Mongo) so
pairing and the invite mailbox are exercised against the production server
code. Fleets use loopback addresses, ephemeral ports, and `--services-url none`
on scenarios that do not need the cloud. The voice-dispatch scenario replaces
OpenAI's chat responses with a deterministic stand-in; it checks discovery and
dispatch, not a real model's interpretation or response quality.

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
npm run e2e              # Tier 1: release scenarios; excludes fleet-large and connectivity
npm run e2e:connectivity # Home connectivity bench; outside the release gate
npm run e2e:fleet        # Tier 2: PEERS_FLEET_SIZE=32
npm run e2e:fleet:large  # Tier 3: PEERS_FLEET_SIZE=100
```

On macOS the `e2e*` scripts run under `caffeinate -i`, so an idle laptop does not sleep and freeze the fleet mid-scenario. That includes the release gate, which runs `npm run e2e`. Closing the lid still sleeps the machine. `npm test` (Tier 0) does not take this assertion.

| Tier | Processes | What it proves | Typical time |
|---|---|---|---|
| 0 | 1 headless smoke process | fresh-user READY with peer networking enabled; topology builders and cap checks, wait helpers, proxy, handle serialization | seconds |
| 1 | ≤ 8 per file | single device, same-user sync, discovery, contacts + group, resilience, faults, connection cap with a small `maxConnections`, packages and contracts across a group, offline package-history catch-up and upgrades, local-folder index and block exchange (256 MB by default), WebRTC sidecar (skipped without a `peers-webrtc` binary), pairing and invites against the real `peers-services` (skipped when it is not built or no Mongo can start) | ~4–5 min |
| 2 | 32 | own-device cap (≤ 8 dials, ≤ 30 connections), hub pruning, tree of 32 with contacts and a group, sync latency percentiles | ~2–3 min |
| 3 | 100 | 10 users × 10 devices: connected within caps, per-user convergence within budget, resource report | ~1–2 min |

Tier 3 needs roughly 13 GB of RSS (about 130 MB per device) and spawns in
waves; it is meant for a workstation or a nightly job, not a default CI runner.
The pre-flight budget check warns when free memory or `ulimit -n` look too small
(macOS under-reports free memory, so the warning there is usually noise; pass
`failOnBudget: true` to make it fatal).

The Tier 1 `dial-retry.e2e.test.ts` scenario uses real Services with no fleet hub. Both
devices have WebRTC; the phone stand-in has no listener and cannot dial device WebSockets.
The test induces one failed WebRTC connection, then restores the target and requires the
phone's automatic retry to connect within 15 seconds. The target cannot rescue the phone
with an outgoing connection. Allow about 50 seconds plus setup (70-second test timeout).
It warns and skips without `peers-webrtc` or Services prerequisites;
`PEERS_E2E_REQUIRE_SERVICES=1` makes missing Services fatal. Run it on its own with
`npm run e2e -- -t 'failed first WebRTC dial retries'`.

The release gate also runs `device-addresses.e2e.test.ts`, with WebRTC off. Two own devices
restart with no `--peer` and no Services, and must reconnect through each other's published
addresses with no broadcast. A device whose published address now reaches another user's
device must refuse that device. With real Services, two devices that both came back on new
ports must find each other by device id without a broadcast and receive each other's updated
addresses.

The release gate also runs `device-scheduler.e2e.test.ts` with real Services and no
WebRTC: eight users bootstrap from empty group device lists through their introducer, then
restart with known Devices rows and cover the group by id without broadcasting in that group.
Personal discovery broadcasts are counted separately by context. Another case starts two
never-met devices of one account with no peer bootstrap link and requires them to discover
each other through Services by broadcast. The role and capacity case checks zero targets among Readers and capacity reporting for more distinct
Writer sources than available slots. Each scenario has a 60-second bound.

Tier 2 records T_cover and asserts at most two outgoing dials per outgoing connection made,
aggregated across each fleet so both dialing ends and glare are counted fairly. A dial
cancelled because the other end's connection won doesn't count; it's a double dial, reported
in `doubleDials`. Its existing
15-second cap sample also limits churn to 32 losses and 38 outgoing dials per second.
It includes a twelve-user variant using real Services, with a two-minute bound. Run this
alongside the existing cap and no-isolation checks; passing discovery must not hide churn.

### Home connectivity bench (opt-in)

Run this when comparing connection fixes. It uses three Mark desktops, Mark's phone,
Blair's laptop and Blair's phone, their personal contexts, and a shared **Home** group.
Blair's laptop has a LAN bootstrap link to Mark's first desktop so Home can converge.
The phones are persistent headless hosts with no listener, a WebRTC sidecar and
`--no-websocket-dial`, leaving only WebRTC in their device protocol list, like the PWA.
A real Peers Services runs behind a latency proxy. S5 temporarily adds three devices
for a third user who is not in Home. Each S6 variant adds a fresh Robin laptop and
phone, with no LAN bootstrap to Mark, and a separate **Club** group to measure
the first cross-user connection through Services.

```bash
cd peers-e2e
npm run e2e:connectivity
npm run e2e:connectivity -- -t S6    # any S1–S7 can run independently
npm run e2e:connectivity -- -t 'S3 short'
npm run e2e:connectivity -- -t 'S6 qr'
PEERS_CONNECTIVITY_REPEATS=3 npm run e2e:connectivity -- -t S2
PEERS_CONNECTIVITY_BASELINE=/absolute/path/to/earlier/connectivity-report.json npm run e2e:connectivity
```

Build the usual siblings listed above (including the updated **peers-headless**, which
must include the SIGCONT resume hook and `--no-websocket-dial`), **peers-services** (`npm run build` there),
and **peers-webrtc** (`make local` there, requires Go). Install peers-e2e's dependencies
with `npm_config_cache="$TMPDIR/npm-cache" npm install` if necessary. Mongo is supplied
by `mongodb-memory-server` (network needed for its first binary download), or set
`PEERS_E2E_MONGO_URI` to a test Mongo server. macOS/Linux and `ps` are required
for process suspension. Missing prerequisites fail this bench
rather than quietly skipping it. No `isolation-*`, `timers`, or other package fixtures
are needed: this bench measures connectivity, without a synthetic package-loading cost.

Budget roughly **10–12 minutes** for all six scenarios and their variants on a Mac,
excluding first-time Mongo download and builds. This estimate needs confirmation on
your machine. A repeat adds another measurement cycle on the same persistent Home
fixture; the report shows medians with observed/total counts. Selecting a scenario
still prepares the complete Home fixture. S3 freezes for 70 seconds (short) and
130 seconds (long); S4 asserts recovery within 20 seconds after its initial
failed dial. Each S6 variant allows 90 seconds after Club exists on Robin's laptop;
it finishes early if a Club connection becomes usable. Robin gets a fresh identity
and group for each variant and repeat so an earlier connection
cannot seed the next attempt. Robin is stopped before S6 restores Blair, and before
either S5 measurement, so Robin never contributes to S5's Services counts.

| Scenario | What to expect with today's connection policy |
|---|---|
| S1: phone cold start | Asserts the first own-device dial starts within 500 ms of Services admission, with no fixed pause. Device traffic must use WebRTC. |
| S2: desktop restart | At both Services latencies, asserts a local dial (the configured `--peer`, or a known device's published address) and the LAN dials start before Services admission. The real scanner uses a loopback address adapter and an isolated fixture port, so it never scans the operator’s LAN. |
| S3 short / long: phone resume | Starts from a covered phone, freezes the host and sidecar, confirms peers dropped it, then continues the same processes. SIGCONT runs the PWA visibility action. Both short (70 s) and long (130 s) resumes plan and probe immediately. Healthy links stay open; ICE-disconnected links use the suspect check. Reports the first resume's T_resume, every resume trigger, observed coverage recovery, and log evidence distinguishing probe starts, probe removals, ping failures and close events. T_resume requires a pong after resume or a newly admitted connection; compare it with the observed recovery cross-check. This models a device frozen with its connections left open, as after a laptop sleeps. A phone that closes its connections when it goes to the background behaves more like S1 after its resume trigger. The slice 1 baseline depended on event order (for example, whether the other side's close notice was waiting when the phone woke), with single samples ranging from about 4 s to about 23 s. Compare with `PEERS_CONNECTIVITY_REPEATS=3` or more. |
| S4: first dial fails | Stops all other possible sources, freezes desktop D's sidecar, and requires a failed outgoing phone WebRTC dial. Restores D's sidecar and requires recovery within 20 s. D can also dial back; D's timeline and sidecar-watchdog activity explain a rescue. |
| S5: known devices past the discovery cliff | Every variant restarts Mark’s devices and Blair’s phone, retaining Devices rows and clearing volatile dial/backoff history. With at least eight Services links, asserts Home connects with zero Home broadcasts and an outgoing group-device dial. Both ends may dial; incoming races stay visible in the report. |
| S6 direct: Services-only group join | Robin and Mark become contacts, then Mark invites Robin to Club. Blair and the load devices are stopped to avoid S5's discovery cliff. Current builds connect through Services. Older builds refuse the group-join and broadcast-answer attempts with “Sending device is not known in dataContext: Club direct”, with no later retry within 90 s. Only Club membership on Robin's laptop and both Robin devices reaching Services are preconditions; group sync is a measurement. |
| S6 qr: Services-only QR join | A fresh Robin accepts the URL encoded by the group-invite QR, without a prior contact invite. Matches the UI defaults: **approve**, **Reader**, one-day expiry; Mark approves the request. Measures the same Services-only join, but approval also saves the requester's observed device identity on Mark's approving host. A connection is a valid outcome; the report records identity-row presence to explain this difference. |
| S7: desktop restart while Services is down | Stops Peers Services, then restarts a desktop with no `--peer`. Asserts the desktop is ready again in its personal context and Home, and that a published address won at least one dial (`dialHints.addressWins`). Reports the time from restart to coverage. Before published addresses only the loopback LAN-scan fixture could reconnect it. Services is started again afterwards. |

Each run retains `connectivity-report.json` and `connectivity-report.md` in its printed
artifact directory. Markdown opens with one headline row per scenario and variant,
then per-scenario detail and timelines, then the full medians. They include
T_first, T_own, T_cover, T_resume, repair start,
startup ready-to-dial time, episode outcomes and coverage, every retained attempt's
target **by fleet label**, queue offsets, transport, reason, stages, outcome, failure
detail (up to 200 characters), broadcasts,
TTL0s, and offline dials. Stage times are relative to the attempt; queue times are
relative to the measured episode. Incoming attempts stay visible. Runtime percentiles
include all retained episodes; the comparison medians use the selected scenario's
measurements. S6's combined timeline includes source labels and attempts from both
users on one clock starting before invite setup (including contacts for direct); its metrics and ordinary
counters come from Robin's laptop, with all devices' counters also recorded. Startup
and resume durations may be blank because S6 begins after startup. Only a
connection ready for Club counts as a Club connection. Reports are rewritten after
each sample, so partial runs remain useful.

The baseline path adds before/after headlines, medians and counters in both files.
Comparisons match scenario and variant exactly: older `S3/default` and `S6/default`
are not silently mapped to the new variants.
Keep latency and observation bounds equal when comparing fixes; differing configuration
is called out. `null` / `—` means **not observed**, never zero, and the denominator shows
how many repeats supplied a measurement. An empty Services-log list means no minute
bucket was emitted in that window. Those buckets can overlap setup and are not exact
scenario-only deltas. No performance target fails this bench yet: assertions check
fixture readiness, the fault's preconditions, transport, and metric availability.
It is excluded from **Tier 1 and the release gate**; `e2e:all` includes it.

All settings below are environment variables; delays and bounds are milliseconds.

| Variable | Default | Purpose |
|---|---:|---|
| `PEERS_CONNECTIVITY_SERVICES_LATENCY_MS` | 90 | One-way delay per TCP chunk in both directions, used by Services URLs and its advertised address. Intended to put socket opening in the hundreds of ms and admission around a second; inspect the measured stages for calibration. |
| `PEERS_CONNECTIVITY_SLOW_SERVICES_LATENCY_MS` | 250 | S2's second Services delay. |
| `PEERS_CONNECTIVITY_LINK_LATENCY_MS` | 10 | One-way listener delay for desktop/laptop links, keeping them much faster than Services. |
| `PEERS_CONNECTIVITY_SHORT_SUSPEND_MS` | 70000 | S3 short freeze: long enough for peers to drop the frozen device. Both variants probe when SIGCONT resumes the process. |
| `PEERS_CONNECTIVITY_SUSPEND_MS` | 130000 | S3 long freeze. Both variants emit a SIGCONT resume episode and run a probe. Too short a freeze can fail the dropped-peer precondition. |
| `PEERS_CONNECTIVITY_OBSERVE_MS` | 45000 | Recovery/discovery observation bound for S1, S2, S3, S7 and each S5 variant. |
| `PEERS_CONNECTIVITY_FAILURE_MS` | 75000 | S4 budget to observe the deliberately failed first WebRTC dial. |
| `PEERS_CONNECTIVITY_RETRY_MS` | 120000 | How long S4 observes recovery. Its separate assertion requires recovery within 20 s, even if observation continues longer. |
| `PEERS_CONNECTIVITY_GROUP_CONNECT_MS` | 90000 | Each S6 variant's window after Club membership reaches Robin's laptop. Captures join attempts made during setup too. |
| `PEERS_CONNECTIVITY_SETUP_MS` | 90000 | Per-device READY and fixture/precondition budget. |
| `PEERS_CONNECTIVITY_REPEATS` | 1 | Repeats of each selected scenario; integer ≥ 1. |
| `PEERS_CONNECTIVITY_BASELINE` | unset | Earlier report JSON for comparison. |
| `PEERS_E2E_ARTIFACTS` | package default | Parent directory for reports, logs and persistent test data. |

#### Fidelity to real devices

**Real:** the runtime's dialing, admission, sync, relay and metrics; Peers Services
with its database; and WebRTC through the desktop's Go sidecar, with signaling
relayed through Services. Phones register only the WebRTC device protocol, like the
PWA, and keep their Services socket. Any outgoing device WebSocket attempt fails
the transport check.

**Induced:** proxy link latency, freezing with SIGSTOP/SIGCONT (the SIGCONT hook
stands in for page visibility), and S4's frozen WebRTC process. WebRTC data channels
remain loopback. The sidecar watchdog and incoming rescue dials are left active.

**Not covered:** phone startup cost (ready to dial about **0.8 s** here versus
**7.65 s** on Mark's phone; Services about **1.0 s** versus **4.5 s**), slow main-thread
package loading and sync batches, browser WebRTC behavior such as glare and ICE
`disconnected`, the PWA's database export costs, TLS, loss, real ICE/TURN/NAT, and
Chrome local-network access.

Removing a fixed wait or serial ordering should save about the same **absolute
time** on a phone. Startup and main-thread improvements cannot be measured here.
Confirm each change on a real device with `getMeshStats` after a release. Reports
from before `--no-websocket-dial` include artificial WebSocket fallback delays;
their removal is a bench correction, not a product latency improvement.

### When to run which tier

- **Tier 0/1** after touching `peers-sdk` sync or connection code, `peers-device`,
  `peers-headless`, `peers-e2e`, or an official package. The scenarios in Tier 1
  need `official-packages/isolation-smoke`, `isolation-consumer`, and `timers` built
  (`npm run build` in each); a missing package build fails its scenario.
  The isolation fixtures use `src/package.ts` and `peers-package build` (guest API 3).
  `webrtc.e2e.test.ts` needs a `peers-webrtc`
  binary (`cd peers-webrtc && make local`, requires Go); without one it prints
  a warning and skips rather than failing. `pairing.e2e.test.ts`,
  `invites-services.e2e.test.ts` and `key-registry.e2e.test.ts` need
  `peers-services/dist` and a Mongo and skip the same way; also run them after
  touching `peers-services` (`auth`, `keys`, `mailbox`, `device-pairing`,
  `connection-*`), `peers-device` `invites/`, `MailboxClient`, the trust path
  (`get-trust-level-fn`, `UsersTable`), or any host's credential store.
- **Tier 2** when touching `connection-manager*`, `network-manager`, `sync-group`,
  `websocket-client`, or device election: the 32-device cap scenario is where
  shedding and redial policy show their real behaviour. Compare
  `sync-latency-same-user.json` before and after.
- **Tier 3** on a workstation or nightly, not per change.

`full-release.js` runs Tier 0 and Tier 1 (plus the `peers-headless` unit and
smoke tests) as Step 2b before anything is versioned or published, and aborts
the release on failure. It builds `isolation-smoke`, `isolation-consumer`, and `timers`
first so the package and scheduler scenarios have bundles, without versioning or publishing
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
| `PEERS_E2E_BLOCK_BYTES` | Size of the noise file in `block-exchange.e2e.test.ts`. Default `268435456` (256 MB). A larger value raises that test's timeout to one hour so a multi-gigabyte run can be started by hand. |
| `PEERS_E2E_BENCH=1` | Run `git-throughput.e2e.test.ts`, a benchmark rather than a check: a second device copies a repository of `TP_MIB` MiB (default 40) from the first through the Git package and logs MiB/s. Skipped otherwise, so it isn't part of any tier. |
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
  needs remote tool access). A member given as `{ member, role }` gets its own
  role, so one group can hold a Reader, a Writer, and an Admin.
- `env` on `fleet.user(...)` or `fleet.addDevice(...)` adds environment
  variables to that device's process, kept across restarts. A scenario can
  preload a test double with `NODE_OPTIONS: "--require <file>"`, as the voice
  scenario does with `scripts/fake-openai.cjs`.
- `toolsContract(contractId, version, toolNames)` is a contract definition with
  just those tools, enough for `device.handle.contract(...)` to call them.
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
  built `official-packages/<name>` through System Packages `importPackage`
  (the same path as `peers packages import`), then releases the build as
  stable so other devices run it, as an official package would arrive. An
  import creates a dev version, and a dev version runs only on a device that
  activated it; pass `release: false` to keep it dev. `fleet.waitForPackage(devices,
  packageId, dataContextId, { probe })` waits until the `Packages` and
  `PackageVersions` rows have arrived and, with `probe`, a local contract tool
  call succeeds on each device, which proves the bundle was downloaded and the
  isolated worker booted. `PEERS_OFFICIAL_PACKAGES_DIR` overrides the default
  `<monorepo>/official-packages`.
- `fleet.installLocalPeersCore(device, others, dataContextId)` imports the
  monorepo's peers-core (Tasks) as a dev build and activates it on `others`:
  the group may already run a released peers-core of the same version.
- `package-lifecycle.e2e.test.ts` makes a fleet-private copy of the built
  `isolation-smoke` artifact and emits schema-v4/v5/v6 versions without
  modifying the official checkout. Its offline follower receives v4 and v5
  across separate sync pages after the schema-v5 `TableDefinitions` pre-pass,
  caches both bundles, and activates only v5 after the watermark is durable.
  It then follows a stable v6 upgrade and proves the selected version survives
  a process restart. Reading the historical v4 bundle while the devices are
  partitioned verifies eager all-version bundle caching rather than an
  on-demand fetch.
- The fixture copier requires guest API 3, keeps `manifest.json` consistent with
  the bundle, and rewrites the bundled runtime message for each version. Replacement
  probe sources receive table/observable member and delivery handlers, so
  `privileged-packages.e2e.test.ts` still exercises consumer reads, subscriptions,
  timer and child-process writes, table watches, and cleanup. `isolated-concurrency.e2e.test.ts`
  exercises concurrent calls, timeouts, and stuck-worker replacement in both
  sandbox and privileged guest API 3 providers.
- `packages-cli.e2e.test.ts` drives one headless host entirely through
  `peers packages`: it imports a fixture copy of `isolation-smoke`, runs its tool,
  writes a version with a corrupt manifest (`writeVersion({ corruptManifest: true })`)
  and checks that `reload` exits `1` while `get` shows the error and the old version
  still serves, reloads a fixed version, writes a provider that throws on its first
  call and reads `runtime.worker.lastWorkerError`, and finally uninstalls.
- `system-files.e2e.test.ts` puts an owner and a Reader in one group with
  `isolation-smoke`. The owner's package saves a 2.5 MiB file through System Files,
  and the Reader's package reads it once the file's row syncs, downloading the contents
  from the owner. The Reader's save is refused (Writer needed), and the CLI saves and
  reads bytes directly, as a screen does.
- `scheduler.e2e.test.ts` installs `timers`, creates a timer, and restarts its
  persistent headless host; the timer expires without a widget or scheduler call.
  It covers both a personal context and a group Writer (40), with group membership asserted.
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
- `device.handle.installPackage(name, { dataContextId, packageLocation })` imports
  a package folder through System Packages; `installPackage(packageId, { update: true })`
  reloads it from that folder; `releasePackage(packageId, { dataContextId })` promotes the
  device's selected dev build to stable (or selects the existing stable build of that
  version) so other devices run it
- `device.handle.onEvents(prefix, handler)`, `device.handle.waitForEvent(...)`
- `device.handle.logs({ sinceMs, level, textSearch })` reads `ConsoleLogs`
- `device.handle.connectedDevices()`, `verifiedPeers()`, `waitForPeer(deviceId)`
- `device.handle.cli(["db", "tables"])` runs the real CLI against this device and
  returns stdout, rejecting on a non-zero exit; `device.handle.cliResult(args)`
  returns `{ code, stdout, stderr }` whatever the exit code, for asserting failures.
  `packages-cli.e2e.test.ts` drives the whole package lifecycle this way
- `device.stop()` (SIGTERM), `device.kill()` (SIGKILL), `device.restart()` for
  `persistent` devices (same identity, device id, database, and listener port)

### Faults

Everything is applied from outside the product.

- Crashes: `device.kill()`, then `device.restart()`. Spokes re-dial their
  bootstrap URL on the peer client's 15 s rescan.
- Suspension: `device.suspend()` / `resume()` freeze and continue the headless host and its WebRTC child. `suspendWebRTC()` / `resumeWebRTC()` affect only the sidecar. Teardown resumes suspended processes before diagnostics and shutdown.
- Services delay: `startFleet({ services: true, servicesLatencyMs: 90 })` puts a stable proxy in front of the service. `fleet.services.setLatencyMs(ms)` changes it during a run; `stop()` / `start()` keep the public URL and proxy.
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
| `connectivity-report.json` / `.md` | Opt-in Home bench metrics, timelines, medians and optional baseline comparison |
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

## Pairing, invites, and the key registry against the real service

`pairing.e2e.test.ts`, `invites-services.e2e.test.ts`, and `key-registry.e2e.test.ts`
and the opt-in connectivity bench run `peers-services`. The service is the production
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
| both online | Two users with no direct edge in this small fixture: the reply is relayed over the service's `user:<id>` route and never touches the mailbox. This does not establish liveness above Services’ discovery-flood limit; S5 measures that limit separately. If this test starts failing with a mailbox count of one, the relay stopped delivering and the fallback to store-and-forward kicked in. |
| Services-only group bootstrap | Two users with no bootstrap peer join a group by QR code (approve mode) and by direct invite, once over WebSocket and once WebRTC-only (the joiner runs `--no-peer --no-websocket-dial`, like the PWA). Each must end with a verified connection both ways and a group row synced to the joiner. If it fails with "Sending device is not known", the group stopped accepting a member's device it hasn't met yet. |

`mailboxCount` runs its query in a child `node` process rather than in the Jest
VM: inside Jest the Mongo driver's handshake serializes without its `driver`
sub-document and the server rejects the connection. `fleet.services.subjectKeys`
reads the `subject_keys` collection the same way.

`key-registry.e2e.test.ts` drives the [key registry](./Key-Registry.md) over
HTTP with one real device: the device's startup registration seeds the
registry; the test verifies the service-signed anchor document against
`fleet.services.publicKey`, checks that a second key and a status change are
refused for a user who already has a key, that a used challenge cannot be
replayed, and that a non-user first claim is refused. The original key still
authenticates.

`peers keys rotate --manual` waits until every on-record anchor lists the new
key. The rotation scenario that drives that path is `key-rotation.e2e.test.ts`.
It also checks that the write retired the old key on the registry: a device
started with Alice's old secret is refused by a contact (its `KeyResolutions`
row is `vetoed`), and that a profile row with the same key and an unconfirmed
anchor list keeps the list already on record.
`key-rotation-email.e2e.test.ts` binds a recovery email through the console
mail transport, opens an anchor-write session, and rotates with
`publish: "anchors"`. A contact then sees the new key.
`key-recovery.e2e.test.ts` publishes a key with no succession signature. A
contest signed by the old key keeps the contact on that key past the delay;
without a contest the contact adopts the new key once the delay elapses. The
scenario sets `PEERS_RECOVERY_DELAY_MS` before the fleet starts so the wait
is a few seconds. That variable is for this test only.
`key-anchors.e2e.test.ts` publishes an extra https anchor through the open
session. A contact adopts it after the peers-services document lists it.
The fleet forces
`PEERS_EMAIL_TRANSPORT=console` so a developer `RESEND_API_KEY` cannot send
real mail.

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
  credentials `peers.app` hands out. The connectivity bench also enables WebRTC; most other scenarios run `--no-webrtc`.
- Multi-host latency and NAT. The loopback proxy adds delay, not packet loss or
  NAT behaviour.

`kitchen-tool-access.e2e.test.ts` exercises group Reader/Writer access to the contracts each Voice Skill v2 provider exposes and to the Groceries and Tasks screens' own contracts, catalog filtering, argument spoofing, and context-bound Grocery/Tasks/Timers actions. It also checks that nothing provides Voice Skill v1. Build Voice Hub, Timers, Weather, News, Groceries, and peers-core before running it. It installs into disposable fleet hosts, never the kitchen device.

`also-implements.e2e.test.ts` releases a package's Notes v1 as stable, upgrades it to v2 with `alsoImplements` v1 (the manifest carrying v1's shape), and checks on a real host that v1's callers are served by v2 after the upgrade and after a restart, and that `peers tools run <name>` finds one tool.

`voice-dispatch.e2e.test.ts` runs real voice turns through Voice Hub's `voice-hub-run-action` as a group Reader, Writer, and Admin, with Timers and Groceries installed as packages built with `definePackage` and `peers-package`. Each host preloads `scripts/fake-openai.cjs`, a stand-in for OpenAI's chat model that asks for a tool only when Voice Hub offered it and logs every request it got. The scenario checks that a Reader is offered only read tools and changes nothing, that a Writer and an Admin set a timer and add groceries, that both are offered the same tools, and that no screen contract is ever offered. Build Voice Hub, Timers, and Groceries before running it.

The `authority-dispatch.e2e.test.ts` scenario uses a generated non-Voice isolated package with Reader, Writer, and Admin group devices. It checks that the declared `authorityPropagation: "preserve"` is honored on every host directly after install, role and ordinary-tool caps, and persistence across a host restart through real headless package loading. `kitchen-tool-access.e2e.test.ts` relies on the same declared mode in the installed Voice packages when testing shared touch/voice gates; no operator grant step exists.
