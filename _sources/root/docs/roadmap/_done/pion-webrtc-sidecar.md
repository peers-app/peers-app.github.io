# Pion WebRTC Sidecar (Electron)

Replace the current simple-peer/renderer-based WebRTC implementation with a Pion (Go) sidecar process. This gives us rock-solid WebRTC data channels that survive UI refreshes, eliminate IPC bottlenecks, and work across all desktop platforms (macOS, Windows, Linux on both AMD64 and ARM64).

## Why

The current architecture runs WebRTC in the Electron renderer process via `simple-peer` (which needs browser WebRTC APIs), then proxies every packet to the main process over Electron IPC. This causes:

1. **Connections die on UI refresh** -- renderer process restarts, all WebRTC connections are destroyed
2. **UI reloads hang** -- WebRTC teardown blocks the renderer
3. **IPC bottleneck** -- every data channel packet crosses the IPC boundary (serialized, deserialized)
4. **File downloads kill connections** -- large transfers saturate the shared IPC channel

## Why Pion

Pion is the most widely deployed non-Google WebRTC implementation (15.9k GitHub stars, 1,403+ importing projects, used by Livekit, Galene, ion-sfu). Key advantages:

- **Pure Go, zero CGO** -- trivial cross-compilation to all 6 targets with `GOOS` + `GOARCH`
- **Battle-tested SCTP/data channels** -- 71% throughput improvement with RACK optimization (316 Mbps sustained)
- **v4.2.3** (Jan 2026), scheduled release cycles, commercial support available
- **Single static binary** per platform (~10-15MB), easy to bundle

Alternatives considered:
- **node-datachannel** (libdatachannel bindings) -- had reliability issues in testing, smaller community (396 stars)
- **werift** (pure TypeScript) -- pre-1.0, slower crypto, not mature enough
- **node-webrtc/wrtc** -- effectively abandoned (last npm publish 4+ years ago)

## Architecture

### Current Flow

```
[Renderer Process (SimplePeer)] <--IPC--> [Main Process (WebRTCManagerProxy)] <--sendDeviceMessage--> [Remote Peer]
```

Every data channel packet: Remote -> SimplePeer in renderer -> Electron IPC -> Main process -> ConnectionManager. UI refresh kills the renderer and all connections.

### New Flow

```
[Go Sidecar (Pion)] <--Unix Socket--> [Main Process (WebRTCSidecar)] <--sendDeviceMessage--> [Remote Peer]
```

Every data channel packet: Remote -> Pion in sidecar -> Unix socket binary frame -> Main process -> ConnectionManager. UI refresh has zero effect. Sidecar can even be restarted independently.

### Signaling (unchanged)

The existing decentralized signaling via `sendDeviceMessage` is kept as-is. The only change is that signal data flows to/from the Go sidecar instead of the renderer:

1. ConnectionManager decides to connect via WebRTC
2. Main process sends `CONNECT` to sidecar
3. Sidecar creates PeerConnection, generates SDP offer
4. Sidecar sends signal back to main process
5. Main process forwards via existing `sendDeviceMessage` (no change to remote peer)
6. Remote signal arrives via `sendDeviceMessage` -> main process forwards to sidecar
7. ICE completes, data channel opens
8. Bidirectional data flows through `DATA` frames

## Go Sidecar Design

### New package: `peers-webrtc/`

A small Go module at the repo root:

```
peers-webrtc/
├── main.go           # Entry point: parse args, start socket listener
├── connection.go     # PeerConnection + DataChannel management via Pion
├── protocol.go       # IPC wire protocol (frame encoding/decoding)
├── signaling.go      # SDP/ICE signal handling
├── go.mod            # Module definition + Pion dependency
├── go.sum
├── Makefile          # Cross-compile for all 6 targets
└── bin/              # Build output (gitignored)
    ├── darwin-amd64/peers-webrtc
    ├── darwin-arm64/peers-webrtc
    ├── linux-amd64/peers-webrtc
    ├── linux-arm64/peers-webrtc
    ├── windows-amd64/peers-webrtc.exe
    └── windows-arm64/peers-webrtc.exe
```

### IPC Protocol

**Transport**: Unix domain socket (macOS/Linux), named pipe (Windows). The socket path is passed as a command-line argument when spawning the sidecar.

**Wire format**: Length-prefixed binary frames:

```
[4 bytes: payload length, big-endian][1 byte: message type][N bytes: payload]
```

**Message types**:

| Byte | Type | Direction | Description |
|------|------|-----------|-------------|
| `0x01` | CONNECT | Node -> Go | Create a new PeerConnection for a given connectionId |
| `0x02` | DISCONNECT | Node -> Go | Close and cleanup a PeerConnection |
| `0x03` | SIGNAL_OUT | Node -> Go | Forward SDP/ICE from remote peer to Pion |
| `0x04` | SIGNAL_IN | Go -> Node | Pion generated SDP/ICE, forward to remote via sendDeviceMessage |
| `0x05` | DATA | Bidirectional | Data channel payload (connectionId + raw bytes) |
| `0x06` | STATUS | Go -> Node | Connection state change (connected, failed, closed) |
| `0x07` | PING | Node -> Go | Health check |
| `0x08` | PONG | Go -> Node | Health check response |
| `0x09` | CONFIG | Node -> Go | ICE server configuration, STUN/TURN settings |

Each frame payload is msgpack-encoded and includes a `connectionId` field so multiple WebRTC connections are multiplexed over the single socket.

**DATA frame optimization**: For data channel payloads (`0x05`), the payload is:

```
[16 bytes: connectionId as UUID bytes][remaining: raw data channel bytes]
```

No msgpack overhead for the hot path.

### Pion Configuration

```go
config := webrtc.Configuration{
    ICEServers: []webrtc.ICEServer{
        {URLs: []string{
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
            "stun:stun4.l.google.com:19302",
        }},
    },
}

// Create ordered, reliable data channel (matches current SCTP config)
dc, err := peerConnection.CreateDataChannel("data", &webrtc.DataChannelInit{
    Ordered:  &ordered,   // true
    Protocol: &protocol,  // "binary"
})
```

### Cross-Compilation (Makefile)

```makefile
BINARY_NAME=peers-webrtc
TARGETS=darwin/amd64 darwin/arm64 linux/amd64 linux/arm64 windows/amd64 windows/arm64

all: $(TARGETS)

$(TARGETS):
	GOOS=$(word 1,$(subst /, ,$@)) GOARCH=$(word 2,$(subst /, ,$@)) \
	go build -ldflags="-s -w" -o bin/$(word 1,$(subst /, ,$@))-$(word 2,$(subst /, ,$@))/$(BINARY_NAME)$(if $(findstring windows,$@),.exe) .
```

No CGO, no C compiler, no platform-specific toolchains. Just `go build`.

## Electron Integration

### New files

**`peers-electron/src/server/connections/webrtc-sidecar.ts`** -- Implements `IProtocolManager`. Spawns the Go binary, manages the Unix socket connection, handles lifecycle (health checks, restart on crash, cleanup on exit).

Key responsibilities:
- Spawn Go binary from `extraResources` path on app startup
- Connect to the Unix socket
- Implement `connectToDevice()` by sending `CONNECT` frame
- Forward signals: `sendDeviceMessage` handler -> `SIGNAL_OUT` frame, and `SIGNAL_IN` frame -> `sendDeviceMessage`
- On `STATUS(connected)`, create an `IBinaryPeer` adapter and call `wrapWrtc()` + `connectionManager.addConnection()` (same as current `handleDataChannelReady`)
- Forward `DATA` frames bidirectionally between the sidecar and the `IBinaryPeer` adapter
- Health check via `PING`/`PONG` every 10 seconds, restart sidecar if 3 consecutive failures

**`peers-electron/src/server/connections/sidecar-protocol.ts`** -- TypeScript implementation of the binary IPC protocol. Frame encoding/decoding, message type constants, connection multiplexing.

### IBinaryPeer Adapter

The key integration point. For each WebRTC connection managed by the sidecar, we create an `IBinaryPeer` that:
- `send(data)` -> encodes as `DATA` frame -> writes to Unix socket
- `on('data', handler)` -> called when `DATA` frame arrives from sidecar for this connectionId
- `on('close', handler)` -> called when `STATUS(closed/failed)` arrives
- `destroy()` -> sends `DISCONNECT` frame to sidecar
- `getBufferedAmount()` -> tracks local socket write buffer

This adapter is passed to the existing `wrapWrtc()` function in `binary-peer-connection.ts`, which creates the `ISocket` and `Connection` objects. **Everything above this layer (ConnectionManager, SyncGroup, sync logic) is completely unchanged.**

### electron-builder Configuration

Platform-specific binary bundling via `extraResources`:

```json
{
  "build": {
    "mac": {
      "extraResources": [{
        "from": "../peers-webrtc/bin/darwin-${arch}/peers-webrtc",
        "to": "peers-webrtc"
      }]
    },
    "win": {
      "extraResources": [{
        "from": "../peers-webrtc/bin/windows-${arch}/peers-webrtc.exe",
        "to": "peers-webrtc.exe"
      }]
    },
    "linux": {
      "extraResources": [{
        "from": "../peers-webrtc/bin/linux-${arch}/peers-webrtc",
        "to": "peers-webrtc"
      }]
    }
  }
}
```

The sidecar binary path at runtime: `path.join(process.resourcesPath, 'peers-webrtc')` (or `.exe` on Windows).

### Files to Delete

- `peers-electron/src/client/webrtc-manager.ts` -- Renderer-side SimplePeer (no longer needed)
- `peers-electron/src/server/connections/webrtc-ipc-handlers.ts` -- IPC bridge between renderer and main (no longer needed)
- `peers-electron/src/server/connections/webrtc-manager-proxy.ts` -- Replaced by `webrtc-sidecar.ts`

### Dependencies to Remove

- `simple-peer` and `@types/simple-peer` from `peers-electron/package.json`
- `werift` from `peers-electron/package.json` (already unused)

## Implementation Order

### Step 1: Go Sidecar Binary

Build the Go module with Pion:
1. `go mod init github.com/peers-app/peers-webrtc`
2. Implement socket listener + binary frame protocol
3. Implement PeerConnection/DataChannel management with Pion
4. Handle incoming signals (SDP offer/answer, ICE candidates)
5. Forward data channel bytes over the socket
6. Cross-compile and test standalone (can test with a simple Go test client, no Electron needed)

### Step 2: Electron Integration

1. Create `sidecar-protocol.ts` -- TypeScript frame encoder/decoder matching the Go implementation
2. Create `webrtc-sidecar.ts` -- spawn binary, connect socket, implement `IProtocolManager`
3. Create `IBinaryPeer` adapter per connection that bridges socket frames to the `IBinaryPeer` interface
4. Wire signaling: `connectionManager.on('webrtc-signal')` -> sidecar, and sidecar signals -> `sendDeviceMessage`
5. On data channel open (STATUS connected): `wrapWrtc(connectionId, adapter, ...)` -> `connectionManager.addConnection()`

### Step 3: Wire Into Startup

In `peers-init.ts`, replace `WebRTCManagerProxy` instantiation with `WebRTCSidecar`. The new class implements the same `IProtocolManager` interface, so `NetworkManager` doesn't know the difference.

### Step 4: electron-builder Config

Add `extraResources` for platform-specific binaries. Update build scripts to run `make -C peers-webrtc all` before packaging.

### Step 5: Remove Old Code

Delete renderer-side WebRTC files, IPC handlers, and `simple-peer`/`werift` dependencies.

### Step 6: Test

- Local network connections between two Electron instances
- NAT traversal (STUN, verify ICE negotiation works)
- File sync over WebRTC data channels
- UI refresh while WebRTC connections are active (the main win -- should survive)
- Sidecar crash recovery (kill the Go process, verify Electron restarts it)
- All three platforms + ARM where possible

## React Native (Future -- Not In Scope)

For mobile, the plan is to replace `simple-peer` in the WebView with `react-native-webrtc` running natively. This eliminates the WebView dependency the same way the sidecar eliminates the renderer dependency. Same `IBinaryPeer` interface, different backend. See separate roadmap item when ready.

## Risk Assessment

- **Low**: `IProtocolManager` / `IBinaryPeer` abstraction means everything above the transport layer is unchanged
- **Low**: Go cross-compilation is the most reliable in the industry
- **Low**: Pion interop with browser WebRTC is extensively tested
- **Medium**: Sidecar lifecycle management (spawn, health, restart). Keep it simple.
- **Medium**: IPC protocol correctness. Keep the protocol minimal, test with fuzzing.
- **Fallback**: Can keep simple-peer alongside the sidecar as a secondary protocol manager during rollout. Both implement `IProtocolManager` and can coexist.
