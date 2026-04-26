# Binary Transport Throughput Optimization

## Problem

The v2 binary-peer-connection achieves ~58 MB/s for local loopback streaming (5 x 1MB chunks via Go sidecar). For a local test where raw Unix socket throughput is several GB/s, this is surprisingly slow.

## Root Cause

The main bottleneck is `setImmediate` yielding in `sendFrame()`. Each 1MB stream chunk is split into ~16 frames at 64KB (`WRTC_CONFIG.maxFramePayload`), and **every frame** triggers a `setImmediate` yield. On Node.js, `setImmediate` fires once per event loop iteration (~0.5-1ms per yield). So 5 chunks x ~16 frames = ~80 yields = ~40-80ms of pure waiting. This lines up with the 86ms observed.

The yielding is necessary to prevent a deadlock where Node.js sends chunks in a microtask chain that starves the Unix socket I/O, preventing the Go sidecar from reading. But yielding on *every* frame is overly conservative.

## Optimization Ideas

### 1. Conditional yielding based on buffered amount

Instead of yielding after every frame, only yield when backpressure is building:

```typescript
async function sendFrame(frame: Uint8Array): Promise<void> {
  // Backpressure wait (unchanged)
  while ((peer.getBufferedAmount?.() ?? 0) > config.highWaterMark) {
    await drainPromise;
  }

  peer.send(frame);

  // Only yield when buffer pressure is building
  if (config.yieldBetweenChunks && (peer.getBufferedAmount?.() ?? 0) > config.lowWaterMark) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}
```

The deadlock only happens when the Go sidecar can't keep up. If `getBufferedAmount()` is well below the high water mark, the pipe is draining fine and there's no need to yield. This gives near-maximum throughput when the pipe is clear and only slows down when pressure builds.

**Risk**: Depends on `getBufferedAmount()` being accurate. Currently `SidecarBinaryPeer` delegates to `FrameWriter.getBufferedAmount()` which returns `socket.writableLength`. If the kernel buffer fills before `writableLength` reflects it, we could briefly over-send. But the backpressure wait at the top of `sendFrame` catches this.

### 2. Larger frame size for streams

The 64KB `maxFramePayload` is conservative. Pion's `MaxDataChannelMessageSize` is set to 16MB, and SCTP handles fragmentation internally. Bumping to 128KB or 256KB would halve or quarter the number of frames (and yields) per chunk:

```typescript
const WRTC_CONFIG: TransportConfig = {
  maxFramePayload: 256 * 1024,  // 256KB instead of 64KB
  // ...
};
```

Or have separate frame sizes for RPC vs streams, since RPC messages are typically small and streams benefit from larger frames.

**Risk**: Larger frames mean more data in-flight before the Go sidecar can process them. With the 8KB macOS Unix socket kernel buffer, a 256KB frame is ~32x the buffer size, so it relies on Node.js buffering and the Go sidecar reading fast enough. The backpressure mechanism handles this, but it's worth testing.

### 3. Smarter yielding cadence (every Nth frame)

Instead of per-frame yielding, yield every N frames:

```typescript
let framesSinceYield = 0;
const YIELD_EVERY_N = 4; // yield every 4th frame

async function sendFrame(frame: Uint8Array): Promise<void> {
  // backpressure wait...
  peer.send(frame);

  if (config.yieldBetweenChunks) {
    framesSinceYield++;
    if (framesSinceYield >= YIELD_EVERY_N) {
      framesSinceYield = 0;
      await new Promise<void>(resolve => setImmediate(resolve));
    }
  }
}
```

This reduces yield overhead by Nx while still giving the I/O event loop regular breathing room.

**Risk**: Less precise than option 1. If N is too high, could still briefly saturate the Unix socket buffer.

## Expected Impact

- Option 1 alone should get throughput to 200-500 MB/s for local tests
- Combining options 1 + 2 could approach GB/s for local loopback
- For real-world WebRTC (over network), the bottleneck will be network bandwidth, not yielding overhead, so these optimizations mainly matter for LAN/localhost scenarios

## Testing

The existing integration test (`stream 5 x 1MB chunks`) already measures and logs throughput. After optimization, expect the speed to increase from ~58 MB/s to 200+ MB/s.
