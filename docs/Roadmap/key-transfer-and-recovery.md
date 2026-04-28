---
sidebar_position: 1
title: "Key Transfer & Recovery"
---

# Key Transfer & Recovery

:::info Status: **Proposed — do before [Device-Specific Keys](./device-keys.md)**
This is a lighter-weight step that solves the two most pressing key-management pain points without changing the key architecture. It should ship first; device-specific keys can build on top of it later.
:::

## Motivation

Today each user has a single Ed25519 keypair. Two practical problems follow:

1. **Getting the key onto a new device is manual and fragile.** Electron stores it in keytar, the PWA stores it in `localStorage`. There is no in-app flow to move the key between devices — users must copy a raw secret string.
2. **Losing the key means losing the account.** There is no recovery path. If the device is wiped or lost, the identity is gone.

Both problems can be solved with small, incremental changes that reuse existing infrastructure and require no schema migration, no verification-logic changes, and no coordinated rollout.

## Part 1 — Secure Key Transfer Ceremony

### Goal

Let a user set up a new device by scanning a code on an existing device, without ever displaying or copying a raw secret key.

### How it works

The existing `connection-code.ts` infrastructure (`encryptWithSecret` / `decryptWithSecret`, 12-char code = 4-char alias + 8-char shared secret) already establishes a symmetric-encrypted channel between two devices. Adapt it for same-user key transfer:

1. **Existing device** generates a transfer code and displays it (QR + text fallback).
2. **New device** enters (or scans) the code, establishing the encrypted channel.
3. **Existing device** confirms intent ("Send your identity to this device?").
4. **Existing device** sends `{ userId, secretKey }` encrypted with the shared secret.
5. **New device** calls `hydrateKeys(secretKey)` and boots normally — same `userId`, same keys, fully interoperable.

### What changes

| Layer | Change |
|-------|--------|
| `peers-sdk` | New `transferKey` / `receiveKey` helpers wrapping `encryptWithSecret` / `decryptWithSecret` |
| `peers-device` | New device-message handler for transfer requests (similar to `userConnectOffer` / `userConnectAnswer`) |
| `peers-ui` | "Link new device" screen on existing device; "Import identity" option on setup screen |
| `peers-pwa` | Calls `setUserIdAndSecretKey` after receiving the key |
| `peers-electron` | Calls keytar `setPassword` after receiving the key |

No changes to `IUser`, `verifyUserSignature`, group key handling, or the sync layer.

### Security properties

- The secret key is encrypted in transit over the shared-secret channel; it never appears as plaintext in UI or logs.
- The transfer requires physical access to (or line-of-sight with) the existing device.
- An attacker who intercepts the code has a window to impersonate the new device, but this is the same threat model as the existing user-connect flow and can be mitigated with a confirmation step on both sides.

### Limitation

The secret key now exists on multiple devices. A compromise of any one device exposes the key permanently (same as today). This is the trade-off that [device-specific keys](./device-keys.md) would later eliminate.

## Part 2 — Paper Key for Recovery

### Goal

Let a user recover their account from a written-down phrase if all devices are lost.

### How it works

At account creation (or on demand from settings), generate a human-readable recovery phrase that deterministically encodes the user's Ed25519 secret key:

1. **Key → phrase:** Convert the 32-byte Ed25519 seed to a BIP39-style mnemonic (24 words) or a compact base58 string.
2. **Display once:** Show the phrase with a clear "write this down and store it safely" prompt. Require the user to confirm a subset of the words.
3. **Recovery flow:** On the setup screen, offer "Recover with paper key." User enters the phrase → derive keys → `hydrateKeys` → boot.

### What changes

| Layer | Change |
|-------|--------|
| `peers-sdk/keys.ts` | `secretKeyToMnemonic(secretKey): string[]` and `mnemonicToSecretKey(words: string[]): string` (or base58 equivalents) |
| `peers-ui` | "Back up recovery phrase" screen (settings); "Recover account" option on setup screen |
| `peers-pwa` / `peers-electron` | Call the same `setUserIdAndSecretKey` / keytar path after recovery |

No schema changes. No migration. The key model is identical — the paper key is just an offline encoding of the existing secret.

### Security properties

- The paper key is equivalent to the secret key. Anyone who has it can impersonate the user.
- It is generated once and stored offline by the user. It never touches the network.
- This is the same model as Keybase's paper keys and many cryptocurrency wallets.

### Open questions

- **Mnemonic vs. base58 string?** Mnemonics are easier to write down and verify visually. Base58 is shorter (44 chars vs. 24 words) and works better for QR codes. Could offer both.
- **Should existing users be prompted to generate a paper key?** Yes, as a non-blocking nudge in settings.
- **Is there a `userId` recovery problem?** The paper key recovers the *keypair*, but the user also needs their `userId` to find their data. Options: encode `userId` alongside the key in the phrase, derive `userId` deterministically from the key, or let the user enter it separately.

## Relationship to Device-Specific Keys

This proposal is **complementary to and a prerequisite for** [device-specific keys](./device-keys.md):

| Concern | Key Transfer & Recovery | Device-Specific Keys |
|---------|------------------------|---------------------|
| Getting keys onto a new device | Secure transfer ceremony | Link-device ceremony (no secret transfer) |
| Account recovery on total loss | Paper key | Still needs paper key or recovery contacts |
| Revoking a compromised device | Not possible (same key everywhere) | Revoke + rotate group key |
| Blast radius of device compromise | Full account (same as today) | Limited to that device's access window |
| Implementation effort | Small (reuses existing infra) | Large (new schema, verification, UX, migration) |
| Migration risk | None | Dual-mode rollout required |

**Recommendation:** Ship key transfer + paper key first. This solves the immediate UX pain (multi-device setup, account recovery) with minimal risk. Then evaluate whether device-specific keys are justified based on user base size, threat model, and whether the PWA can offer real key isolation (WebAuthn PRF, etc.).
