# Implement WebRTC connections

Currently we're just using socket.io connections which is the preferred way to bootstrap onto a Peers network for local networks.  But if an internet connection is available then we also want to use WebRTC connections to connect to computers across the internet.

Review the following files to understand the work that has already been done to implement abstract connections and then concrete usage on top of socket.io
- peers-sdk/src/device/socket.type.ts
  - the interface that we expect all connection types to implement (socket, WebRTC, and anything else we implement in the future)
- peers-sdk/src/device/connection.ts
  - the top level abstraction for connections in Peers (note that it takes a `socket: ISocket` in it's constructor)
  - note the handshake logic - what is key is that the connection class represents both the initiator and receiver side of the connections but the handshake logic that is executed depends on which side the instance represents.  
- peers-device/src/connection-manager/connection-manager.ts
  - the device-level connection manager that will manage which connections should included for which groups. 
  - Note that all device communication is currently done via syncing their dbs and requesting files.  
- peers-electron/src/server/connections/connections-server.ts
  - this is the current "receiver-side" of socket connections
- peers-electron/src/server/connections/connections-client.ts
  - this is the current "initiator-side" of socket connections

Some work already went into implementing the WebRTC side this but it was never fully integrated into the project.  Files to look at 
- peers-electron/src/server/connections/wrap-wrtc.ts
  - Note that this will probably be specific to electron so it should stay in electron.  
- peers-electron/src/server/connections/peer-tx.ts
  - this is supposed to be a generic implementation that should work with all connections to gracefully handle transmitting different data types with automatically compression
  - this should moved to peers-sdk and should use fflate instead of zlib so it's isomorphic JS (which peers-sdk is required to be so it runs everywhere - node, browser, react-native, etc.) leave this for last.

Note the peers-service project which is where we'll probably need to implement some signaling service for establishing WebRTC connections

Tasks 
- [ ] First step is to find all markdown docs related to connections and move them to peers-app.github.io/docs/connections
- [ ] Second, write a top level doc (keep it short and concise, include mermaid diagram) how how abstract connections and handshakes work
- [ ] Third, write a proposal for implementing a WebRTC connection wrapper that does the minimal work to incorporating them into the existing connection manager

Future Tasks
- [ ] redo the peer-tx implementation to use msgpack and fflate to abstract away the logic for chunking data and deciding when to compress the data.  