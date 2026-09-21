---
sidebar_position: 9
---

# Headless host

`peers-headless` runs the Peers runtime in a Node.js process: no Electron, no
window, no UI. It is a first-class App host. One user per process.

Use it as an always-on personal node, a CI / agent target, or a second device
in scripted tests. The Electron app, PWA, and hosted k8s device are separate
hosts; they do not import this package yet.

## Start

```bash
cd peers-headless
npm run build

# Ephemeral (in-memory SQLite), no cloud services
npx peers-headless --new-user --db :memory: --print-credentials --services-url none

# Persistent
npx peers-headless --new-user --db ~/peers/headless/alice --name Alice
# later launches reuse <db>/credentials.json
npx peers-headless --db ~/peers/headless/alice
```

With an on-disk `--db`, `--new-user` writes `{ userId, secretKey }` to
`<db>/credentials.json` (mode 0600) and refuses to overwrite an existing file.
Explicit `--user-id`/`--secret-key`, `--credentials <file>`, or
`USER_ID`/`SECRET_KEY` override it. `--name` only applies on first boot; a
rename from another device is kept. `peers app restart` re-execs as the same
identity.

## Pair instead of copying a secret

To add a headless host to an account you already use, do not copy the secret
key around. Start it signed out with `--pair`:

```bash
npx peers-headless --pair --db ~/peers/headless/server --name "Home server"
```

It creates a rendezvous room on `--services-url` (default `https://peers.app`)
and prints a code such as `7-guitar-revenge-tunnel`, plus a QR code when stdout
is a terminal. On a signed-in device choose **Settings → Add another device**
and scan or type the code, or on a signed-in host run
`peers pair 7-guitar-revenge-tunnel`. When you approve, the headless process
receives the credentials over a direct WebSocket, writes
`<db>/credentials.json` (mode 0600), and continues booting as that account in
the same process. The secret never appears on argv, in the environment, or in
logs. Later launches need only `--db`.

While pairing, the process listens on `--peer-port` (default 3341) for the
signed-in device and advertises `http://<lan-ip>:<port>` and
`http://127.0.0.1:<port>`; the normal device-mesh listener takes the port over
once pairing completes. Only a socket presenting the PAKE-derived token for the
current code is admitted, and only one. If the host sits behind a proxy or TLS
terminator, advertise the public origin instead:

```bash
npx peers-headless --pair --db /srv/peers --pair-url https://peers.example.com
```

`--pair` refuses to run when `<db>/credentials.json`, explicit credentials, or
`USER_ID`/`SECRET_KEY` already provide an identity, and it needs a
`--services-url` (not `none`) for the rendezvous. Each line of progress is
printed; `PAIRING_CODE <code>` is a machine-readable marker for scripts. A
failed attempt rotates to a new code; if the runtime had already initialized
when the failure happened, the process exits non-zero and should be started
again. Details of the ceremony are in [Add another device](./Device-Pairing.md).

The signed-in side is available too: `peers --auth-file ~/peers/cli/headless-auth.json pair <code>`
approves a new device from a headless host.

The process binds a frontend socket on `127.0.0.1` and writes
`~/peers/cli/headless-auth.json` (`port` + token). That path is separate from
Electron's `~/peers/cli/cli-auth.json`, so a running desktop app is not stolen.

Point the CLI at this host without hijacking Electron:

```bash
peers --auth-file ~/peers/cli/headless-auth.json db query "SELECT name FROM Users"
```

`PEERS_CLI_AUTH_FILE` is the same override. `--write-cli-auth` still replaces
the default Electron auth file if you want that.

`--port 0` binds an ephemeral frontend port. `--peer-port 0` binds an
ephemeral device-mesh port and `--peer-host 127.0.0.1` restricts it to
loopback (default is every interface). `--no-db-access` disables
`SELECT`/`PRAGMA` over the socket (allowed by default on a headless host).
`--no-peer` skips the mesh listener.

A machine-readable `READY {json}` line is printed on stdout when the host is
up (`userId`, `deviceId`, `port`, `token`, `authFile`, `peerPort`, `webrtc`).

## WebRTC (optional)

Device-to-device WebRTC runs in a separate Go process, `peers-webrtc`, the same
sidecar the desktop app ships. It is an optional dependency: `peers-headless`
does not bundle the binary, and a host without one (or with one that keeps
crashing) boots and forms WebSocket edges exactly as before. WebRTC adds the
paths a plain listener cannot cover: two devices that both sit behind NAT with
no reachable `--peer-port`, and a pairing destination that a source cannot
dial directly.

Discovery order at startup:

1. `--webrtc-sidecar <path>` (or `PEERS_WEBRTC_SIDECAR`): use exactly this
   binary. If it does not exist the host logs one line and continues without
   WebRTC.
2. Otherwise auto-detect: the sibling dev build for this platform
   (`../peers-webrtc/bin/<goos>-<goarch>/peers-webrtc`), the legacy
   un-suffixed `../peers-webrtc/bin/peers-webrtc`, then `peers-webrtc` on
   `PATH`.
3. `--no-webrtc`: never look for or start a sidecar (`webrtc: "off"`).

Build the binary once with `cd peers-webrtc && make local` (needs Go); the
monorepo checkout then auto-detects it. Nothing is started when `--no-peer` is
given, since there is no mesh to take part in.

Status shows up in three places. The startup log prints `[WebRTC] Starting
sidecar <path>` then `[WebRTC] sidecar ready`, or a single `[WebRTC] ... 
continuing with WebSocket only` line naming the flags when nothing was found.
The `READY` payload carries `webrtc`: `off`, `starting`, `ready`, `down`, or
`unavailable`. And `NetworkManager` only advertises `wrtc` to peers while the
sidecar is authenticated (`isAvailable()`), so a host whose sidecar is starting
or gone never invites a 30 s WebRTC timeout from the other side.

Failure handling is bounded. A sidecar that exits before authenticating or
within a few seconds of spawning counts as a failed start; restarts back off
(2 s, 4 s, ... 60 s) and after five consecutive failures the host stops
retrying, logs `[WebRTC] sidecar unavailable; continuing with WebSocket only`,
and keeps running. A sidecar that ran healthily and then died is restarted
with the counter reset.

Scope on loopback: two headless hosts on one machine exercise the signaling
path, the datachannel state machine, and sync over `wrtc://`; they do not
exercise STUN/TURN or NAT traversal. If both sides dial at once, the device
with the lexicographically smaller `deviceId` keeps its offer and the other
answers it (`[Sidecar] WebRTC glare ...` in the logs). Without that rule each
side dropped its own offer and the `wrtc://` edge never formed.

## What it does

- Calls `initializePeerDevice` with `DBLocal` (file or `:memory:`)
- Encrypts secret persistent variables and decrypts them for workflows
- Loads system tools and installs `peers-core` from the local bundle (S3 only
  when `--services-url` is not `none`)
- Registers the Node isolated-package runtime
- Captures console output into `ConsoleLogs`
- Serves the same socket.io RPC + system contracts the CLI already uses,
  including `addOrUpdatePackage`: `peers packages add <name|url|id>` installs,
  imports, clones, or copies packages exactly as on Electron. The installer
  itself lives in the Runtime (`peers-device`'s `package-install`); headless
  gives it plain Node filesystem and shell deps. Remote-repo linking
  (`--link-remote`) is Electron-only because it needs `git`/`gh`
- Listens for device connections (`--peer-port`, default 3341) and can dial
  explicit peers (`--peer http://127.0.0.1:3342`)
- Registers the WebRTC sidecar as a second protocol manager when a
  `peers-webrtc` binary is found (see [WebRTC](#webrtc-optional)); the
  sidecar itself lives in the Runtime (`peers-device`'s `WebRTCSidecar`) and
  is shared with the desktop app
- Dials devices it discovers, not only the ones on argv: a `ws` protocol manager
  lets `NetworkManager` connect to own devices found in the synced `Devices`
  table, peers learned from another device's network info, and group admins on
  join. Addresses come from `Devices.serverUrl` and from asking the target
  (`get-ws-addresses` over the mesh); the target answers with what it
  advertises: `http://127.0.0.1:<peer-port>` plus its LAN address, or the
  `--advertise-url` origins when given (hosts behind a reverse proxy or NAT)
- Device pairing on both sides: `--pair` as the signed-out new device (direct
  WebSocket transport), `peers pair <code>` as the signed-in approver
- Logs unhandled promise rejections instead of exiting, like Electron's main
  process, so a peer disconnecting mid-sync cannot take the host down
- One process, one user — spawn another process for a second device

## Offline / test flags

| Flag | Purpose |
|---|---|
| `--services-url none` | No mailbox, no `peers.app` discovery |
| `--no-peer` | Do not listen for other devices |
| `--peer-host 127.0.0.1` | Mesh listener on loopback only |
| `--peer <url>` | Connect to a known peer (repeatable) |
| `--advertise-url <url>` | Origin other devices dial to reach this listener instead of the detected addresses (repeatable) |
| `--lan-scan` | Scan the LAN for Electron peers on port 3333 |
| `--max-connections <n>` | Override the device connection cap (default 30). A testing knob: a small cap reproduces at-capacity shedding with a handful of devices (`peers-e2e`'s `cap.e2e.test.ts` uses 4) |
| `--webrtc-sidecar <path>` | Use this `peers-webrtc` binary instead of auto-detecting (`PEERS_WEBRTC_SIDECAR` is the same) |
| `--no-webrtc` | Never look for or start the WebRTC sidecar; WebSocket edges only |

## Testing with it

Multi-device scenarios live in `peers-e2e`; see
[End-to-end fleet testing](./E2E-Testing.md). It spawns fleets of real headless
processes (up to 100), wires them into a mesh over loopback, and drives each
through its RPC socket, with per-device logs, mesh snapshots, and fault
injection. `npx peers-fleet up` from that package stands up the same fleet
detached for interactive or agent use.

`peers-headless` itself keeps only the spawn helpers and a runtime smoke suite.
`@peers-app/peers-headless` exports `spawnHeadlessProcess` and `runPeersCli`:
each spawned host is a separate process (in-memory SQLite, ephemeral ports,
loopback mesh, `--services-url none`) that prints `READY {json}`; the CLI is
pointed at it with `--auth-file`. Children run without `NODE_ENV=test` so the
runtime behaves like a real device. Set `PEERS_HARNESS_DEBUG=1` to mirror every
child's output to the test's stderr. In `peers-headless`: `npm test` (unit +
in-process smoke), `npm run test:live` (real hosts + CLI), `npm run test:all`.

For pairing, `startTestPairingRendezvous` starts a happy-path stand-in for the
`peers.app` room on loopback and `spawnPairingHeadlessProcess` starts a `--pair`
host and resolves with its code (`ready` resolves with the READY payload once a
source approves). `live.pairing.test.ts` pairs two real headless processes this
way, driving the source with `peers pair <code> --yes`.

## Not yet

- UI / static file serving
- `peers://` protocol handling
- Shipping the `peers-webrtc` binary with `npx peers-headless` (a
  platform-specific optional package or a release download); today you build
  it or point `--webrtc-sidecar` at one
- Pairing over WebRTC: `--pair` still uses the direct WebSocket transport, so a
  headless destination needs a source that can reach one of its advertised
  URLs
