---
sidebar_position: 2
title: "Device-Specific Keys"
---

# Device-Specific Keys

:::info Status: **Design / Planning**
This document captures the evolving design for moving from user-level secret keys to device-level keys.
:::

:::tip Prerequisite
[Key Transfer & Recovery](./key-transfer-and-recovery.md) solves the immediate multi-device and account-loss pain points with minimal architectural change. Ship that first; this design builds on top of it.
:::

## Motivation

Today each user has a single Ed25519 keypair. The secret key **is** the user's credential -- they need it to sign updates to their user object and to decrypt data. This means:

- Users must back up and transfer a secret key between devices.
- Losing the key means losing the account.
- Exposing the key compromises the account permanently.

The goal is to make keys **device-specific** so that:

- Each device generates its own keypair; the private key never leaves the device.
- Users never see or manage secret keys.
- A user's `userId` is the only identifier they need to track, and it's not sensitive.
- Adding a new device is done through a secure link-device ceremony.

## Core Idea

A user's identity becomes a **set of authorized device keys** rather than a single key. This is the same model used by Signal, Matrix/Element, FIDO2/Passkeys, and Keybase.

### Everything is a group

Peers already uses shared group keys for multi-device/multi-user data access. Under this design, a user's personal data is just another group whose members are their own devices. This collapses the user-encryption and group-encryption code paths into one:

| Concept | Current | Proposed |
|---|---|---|
| User's own data | Encrypted to user's single `publicBoxKey` | Encrypted with the user's **personal group key**, which is itself encrypted to each device key |
| Group data | Group key encrypted to each member's user key | Group key encrypted to each member's **device keys** (same mechanism) |
| Adding a device | N/A (secret key must be transferred) | Same as adding a member to a group: encrypt the group key to the new device's public key |
| Revoking a device | N/A | Same as removing a group member: rotate the group key, re-encrypt to remaining devices |

This eliminates branching between "user encryption" and "group encryption" -- there is one path to build, test, and audit.

## Schema Changes

### User object

The `IUser` schema currently has singular `publicKey` and `publicBoxKey` fields. These would either:

**Option A -- Inline array:**
```typescript
// User object carries an array of authorized device keys
deviceKeys: Array<{
  deviceId: string;
  publicKey: string;       // Ed25519 signing key
  publicBoxKey: string;    // X25519 encryption key
  authorizedBy: string;    // deviceId that authorized this one
  authorizedAt: string;    // ISO 8601
}>
```

**Option B -- Separate table:**
A `UserDeviceKeys` table indexed by `(userId, deviceId)` with the same fields. Keeps the user object lean and avoids rewriting it every time a device is added.

**Open question:** Which approach works better with the sync model? The user object is already a signed snapshot. Adding devices as rows in a separate table may be simpler for conflict resolution.

### Signature verification

`verifyUserSignature` currently checks that the signer's public key matches `user.publicKey`. With multi-device keys it would check that the signer's public key is in the set of authorized device keys for that user.

The rule "Prevent public key changes" in `user-permissions.ts` would be replaced by "only an authorized device can modify the set of authorized devices."

## Link-Device Flow

When a user wants to add a new device, both devices must be under the user's control. The ceremony needs to establish mutual trust without a pre-existing shared secret.

### Proposed flow

1. **New device** generates its own keypair and displays a short connection code (the existing `user-connect` / connection-code machinery can be adapted).
2. **Existing device** enters (or scans) the code, establishing a secure channel.
3. **Existing device** verifies intent (user confirms on both devices).
4. **Existing device** signs a statement: "I (device A, authorized for user X) authorize device B's public key for user X."
5. This signed authorization is written to the user's device-key set (user object or `UserDeviceKeys` table).
6. **Existing device** encrypts the user's personal group key to the new device's public key, so it immediately has access to the user's data.

### Bootstrap (first device)

When a user creates their account on device 1:
- Device 1 generates a keypair.
- A personal group is created with device 1 as the sole member.
- The user object is signed by device 1's key.
- No link-device ceremony needed; this device is the root of trust.

### Edge case: adding device when only one device exists

If the user only has one device, that device is the sole authority. If they lose it before linking a second device, the account is unrecoverable (same trade-off as Signal). See [Recovery](#recovery) below.

## Device Revocation

An authorized device can sign a statement revoking another device. This triggers:

1. The revoked device's key is removed from the authorized set.
2. The personal group key is rotated (same as removing a group member).
3. The new group key is encrypted to all remaining devices.

**Open question:** Should any authorized device be able to revoke any other, or should there be a hierarchy (e.g., the device that authorized another can revoke it)? A flat model is simpler; a hierarchical one prevents a compromised device from revoking legitimate ones.

## Recovery

If all devices are lost, the account is unrecoverable under a pure device-key model. Possible mitigations:

| Strategy | How it works | Trade-off |
|---|---|---|
| **Paper key** (Keybase model) | Generate a high-entropy recovery phrase at account creation; user stores it offline | Reintroduces a secret the user must manage, but it's opt-in and rare |
| **Recovery contact** | A trusted peer can authorize a new device for the user via a ceremony | Requires social trust; needs careful design to prevent social engineering |
| **Threshold recovery** | Split a recovery key across N trusted contacts; K-of-N required to recover | Complex but robust; no single point of compromise |
| **Accept the loss** (Signal model) | Account is gone; user starts fresh | Simplest; data may still exist on peers' devices if they re-establish connections |

**Open question:** Which recovery strategy (if any) to support at launch vs. later.

## Migration Path

Existing users have a single `publicKey`. Migration options:

1. **Treat the current key as "device 1."** The existing secret key becomes the first device key. Users who already have accounts don't need to do anything immediately -- their current device is auto-enrolled. Next time they set up a new device, they use the link-device flow instead of transferring a secret key.

2. **Dual mode during transition.** Accept both single-key and multi-key user objects. `verifyUserSignature` checks: is the signer's key the legacy `publicKey`, or is it in the `deviceKeys` set? This avoids a flag-day migration.

## Open Questions

- [ ] Inline device keys on the user object vs. separate `UserDeviceKeys` table?
- [ ] Flat vs. hierarchical device revocation?
- [ ] Which recovery strategy (if any) for v1?
- [ ] How does this interact with the PWA? PWAs don't have a secure enclave -- where does the device key live? (IndexedDB + encryption? Browser crypto.subtle non-exportable keys?)
- [ ] Should the connection-code system be reused as-is or adapted for device linking specifically?
- [ ] Timeline: can this be done incrementally behind the dual-mode migration, or does it need a coordinated cutover?
