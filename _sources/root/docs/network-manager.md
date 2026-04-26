# Network Manager

The Network Manager is responsible for deciding when and which devices to connect to, maintaining a "well connected" network for efficient P2P synchronization.

## Overview

In a peer-to-peer system, being "well connected" means having enough connections to reliably sync data. The Network Manager automatically:

1. **Connects to your own devices** for personal data sync (up to 8 devices)
2. **Connects to other users' devices** for group data sync (prioritizing user diversity)
3. **Learns about the network** by querying connected peers for their connections
4. **Tracks connection history** to make smart retry decisions

## Key Concepts

### User Diversity

The biggest challenge in P2P networks is avoiding "isolated subgroups" where users only connect to their own devices. If Alice has 3 devices all connected to each other, she might think she's well connected - but she has no connection to Bob's devices, so group data won't sync.

The Network Manager solves this by **prioritizing connections to other users** over connections to your own devices.

### Preferred Devices

When querying peers for their network info, we learn which devices they consider "preferred" - reliable, well-connected nodes in the network. The Network Manager prioritizes connecting to these hub devices.

### Dynamic Connection Targets

The number of connections needed depends on group membership:
- **2-person group**: 1 connection to the other user is sufficient
- **5-person group**: Connect to all 4 other users
- **50-person group**: Connect to 5 users (capped for efficiency)

## Connection Priority

When deciding which devices to connect to, the Network Manager uses a 5-tier priority system:

| Tier | Description | Why |
|------|-------------|-----|
| 1 | Preferred devices of OTHER users (not yet connected) | Best: reliable + user diversity |
| 2 | Non-preferred devices of OTHER users (not yet connected) | User diversity is critical |
| 3 | Devices of OTHER users we're already connected to | Redundancy for existing users |
| 4 | Preferred devices of MY OWN user | Reliable but no user diversity |
| 5 | Non-preferred devices of MY OWN user | Fallback only |

Within each tier, previously successful connections (`connectedThenDisconnected`) are preferred over untried devices.

## Personal Devices

Your own devices are special - they sync your data across all groups. The Network Manager:

- **Always tries to connect** to all your personal devices
- **Caps at 8 devices** (if you have more, it prioritizes preferred ones)
- Handles this **separately** from group connectivity

## Connection Status Tracking

The Network Manager tracks every device it learns about:

| Status | Meaning |
|--------|---------|
| `notTried` | Never attempted connection |
| `triedButFailed` | Connection attempt failed (60s cooldown before retry) |
| `connected` | Currently connected |
| `connectedThenDisconnected` | Was connected, now disconnected (prioritized for reconnection) |

## Protocol Preferences

When connecting to a device, protocols are tried in order of preference:

1. **wss/https** - TLS websockets, most reliable
2. **ws/http** - Unencrypted websockets (local networks, peers high-level encryption adds latency)
3. **webrtc** - Best NAT traversal, essential for PWA devices that can't LAN scan

## Troubleshooting

### Not syncing with group members

Check the Network tab to see your connections. If you're only connected to your own devices:
- Other users may be offline
- Network connectivity issues between you and other users
- The Network Manager will continue trying to connect

### Too many connections

The system caps at MAX_CONNECTIONS (30 by default). If you're in many groups, some might have fewer connections than ideal. The system prioritizes based on activity and group membership.

### Slow initial sync

When first joining a group with no connections, the system uses a "bootstrap" broadcast to discover devices. This may take a few moments to find available peers.
