# WebRTC Testing in Electron

This document provides guidance on testing WebRTC functionality in an Electron environment.

## Testing PeerTx with WebRTC

The `PeerTx` class is designed to work with WebRTC peers using the SimplePeer library. While the unit tests use mocks and simulated peers, there are cases when you need to test with actual WebRTC connections.

### Testing in Node.js (Main Process)

Testing WebRTC in Node.js (Electron's main process) requires a WebRTC implementation. The standard approach is to use a native module like `wrtc` or `@koush/wrtc`, but these can be challenging to install on certain platforms like Apple Silicon Macs.

### Testing in Renderer Process

The best way to test WebRTC in Electron is to use the renderer process, which has access to the browser's native WebRTC APIs.

Here's an example of setting up a test in an Electron renderer process:

```typescript
// In a renderer process test file
import { PeerTx } from './peer-tx';
import SimplePeer from 'simple-peer';

// Create the peers (no need for wrtc in renderer)
const peer1 = new SimplePeer({ initiator: true, trickle: false });
const peer2 = new SimplePeer({ trickle: false });

// Connect the peers
peer1.on('signal', data => peer2.signal(data));
peer2.on('signal', data => peer1.signal(data));

// Set up test data flow
peer1.on('connect', () => {
  // Use PeerTx to send and receive data
  const receiver = PeerTx.receive({
    peer: peer2,
    onData: (data) => console.log('Received:', data),
    onEnd: () => console.log('Transfer complete')
  });

  // Send test data
  PeerTx.send(peer1, { test: 'data' });
});
```

### Testing with External Nodes

For more comprehensive testing, consider setting up test cases that connect to external STUN/TURN servers or test peer-to-peer connections across different networks.

## Manual Testing in Electron

You can add a manual test page to your Electron app:

1. Create a renderer page with controls to establish connections
2. Add UI elements to send different types of data (strings, objects, files)
3. Display received data in a log or visualization
4. Add metrics for connection establishment time, data transfer speeds, etc.

This approach allows you to test WebRTC functionality with real-world scenarios while having direct access to debug tools.

## Configuring ICE Servers

For testing peer connections that need to traverse NATs or firewalls:

```javascript
const peer = new SimplePeer({
  initiator: true,
  trickle: false,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  }
});
```

## Debugging WebRTC Issues

- Use Chrome's `chrome://webrtc-internals/` in a browser for detailed WebRTC diagnostics
- In Electron, use `webContents.openDevTools()` to access similar tools
- Look for ICE connection failures, which often indicate NAT traversal issues
- Check for codec compatibility if media streaming is involved
