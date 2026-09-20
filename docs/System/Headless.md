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
up (`userId`, `deviceId`, `port`, `token`, `authFile`, `peerPort`).

## What it does

- Calls `initializePeerDevice` with `DBLocal` (file or `:memory:`)
- Encrypts secret persistent variables and decrypts them for workflows
- Loads system tools and installs `peers-core` from the local bundle (S3 only
  when `--services-url` is not `none`)
- Registers the Node isolated-package runtime
- Captures console output into `ConsoleLogs`
- Serves the same socket.io RPC + system contracts the CLI already uses
- Listens for device connections (`--peer-port`, default 3341) and can dial
  explicit peers (`--peer http://127.0.0.1:3342`)
- One process, one user — spawn another process for a second device

## Offline / test flags

| Flag | Purpose |
|---|---|
| `--services-url none` | No mailbox, no `peers.app` discovery |
| `--no-peer` | Do not listen for other devices |
| `--peer-host 127.0.0.1` | Mesh listener on loopback only |
| `--peer <url>` | Connect to a known peer (repeatable) |
| `--lan-scan` | Scan the LAN for Electron peers on port 3333 |

## Testing with it

`@peers-app/peers-headless` exports `spawnHeadlessProcess` and `runPeersCli`.
Each spawned host is a separate process (in-memory SQLite, ephemeral ports,
loopback mesh, `--services-url none`) that prints `READY {json}`; the CLI is
pointed at it with `--auth-file`. Children run without `NODE_ENV=test` so the
runtime behaves like a real device. In `peers-headless`: `npm test` (unit +
in-process smoke), `npm run test:live` (real hosts + CLI), `npm run test:all`.

## Not yet

- UI / static file serving
- `peers://` protocol handling
- WebRTC sidecar and device pairing as a signed-out destination
