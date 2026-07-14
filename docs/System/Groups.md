---
sidebar_position: 8
---

# Groups

Groups are shared data contexts. Records created in a group can synchronize between its
members' devices without exposing the member's personal data context.

Creating a group generates a signing key and an encryption key, stores the public keys on
the signed `Groups` record, and stores the secret key as an encrypted personal persistent
variable. Peers validates that a stored group secret derives the public keys on the group
record before using it. A mismatched or malformed key is rejected instead of being used to
encrypt new group data.

Targeted device messages use the target user's public key from the shared group's `Users`
and `Devices` records. This lets devices owned by different users exchange signaling and
administration messages without depending on the sender's local copy of the group secret.
Messages encrypted to the whole group continue to require matching group key material.

On receipt, Peers first verifies that the declared context is the device's personal context
or an enabled `Groups` record. It then resolves the sender's `Devices` and `Users` records
only inside that exact context and requires both the box and signature keys to match. Missing
or conflicting identities fail before a device handler runs; stale personal records cannot
override the identity recorded in the declared shared group.

## Display names

The signed connection handshake can include optional user and device display-name hints.
Each hint is limited to 128 characters. They are presentation metadata, not identity:
device and user IDs plus the signing keys remain authoritative.

The user hint fills the brief gap before the owner's signed `Users` row reaches a group.
That signed row remains canonical and owner profile changes are copied from the owner's
personal context into each group. The device hint is stored as `reportedName` on the
existing `Devices` row and synchronizes with the group.

A device record's `name` is the local user's label, while `reportedName` is the latest
label advertised by the device owner. Interfaces prefer `name` and fall back to
`reportedName`, so another user's handshake cannot replace a local label. Updated hints
arrive on the next connection handshake; they are intentionally not included in the more
frequently exchanged network information.

## Diagnosing group connectivity

The desktop Network Viewer shows direct connections and shared-group routes. Owners can
also use the [CLI](./CLI) to inspect a directly connected device:

```bash
peers devices
peers devices status <deviceId>
peers db query "SELECT * FROM Groups" --device <deviceId> --json
peers db query "SELECT * FROM Devices" --context <groupId> --device <deviceId> --json
```

See [Network diagnostics](./Network-Diagnostics) for authorization requirements, query
limits, and the records to compare when a device is visible but signaling fails.
