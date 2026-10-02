---
sidebar_position: 12
title: Key Registry
---

# Key Registry

A **key registry** answers one question for any Peers ID: *which public keys
belong to this subject right now, and which ones must never be trusted
again?* `peers.app` runs the default registry as part of `peers-services`;
a user can point at another registry alongside it or instead of it, and
everything that works without `peers-services` keeps working without any
registry.

A subject is any 25‑character Peers ID: a user, a package, a group, or a
device. Each subject can have **several active keys** so a rotation can
overlap (add the new key, move devices over, retire the old one later), and
a key can be **revoked** when it is lost or compromised.

The registry stores only public keys and signatures. It never holds secret
keys, password hashes, or recovery codes.

## Key records

| Field | Meaning |
|---|---|
| `subjectId`, `subjectType` | the Peers ID and whether it is a `user`, `package`, `group`, or `device` |
| `algorithm`, `publicKey`, `publicBoxKey` | `ed25519` today; the X25519 encryption key is derived from the signing key |
| `status` | `active`, `retired` (no longer used, still trusted for old signatures), or `revoked` (never trust) |
| `reason` | `rotation`, `compromised`, `lost`, or `expired` |
| `label`, `notBefore`, `expiresAt` | optional metadata and validity window |
| `authorizedBy` | the existing key that approved this one |

`active → retired → revoked`; revoked is final and the same key material
cannot be added again.

## API

Base path: `https://peers.app/api/v1/keys`. Reads are public; everything is
rate limited per IP.

| Call | What it does |
|---|---|
| `GET /.well-known/peers-key-registry.json` | The registry's own ID and signing key. Pin this; every signed read verifies against it. |
| `GET /api/v1/keys/:subjectId` | All keys for a subject, signed by the registry (`{ contents, signature, publicKey }`). `contents.primary` is the newest usable key; `userId`/`publicKey`/`publicBoxKey` are kept for older clients. |
| `GET /api/v1/keys/:subjectId/:publicKey` | One key record, signed. A cheap "is this key revoked?" check. |
| `POST /api/v1/keys/:subjectId/challenge` | `{ publicKey }` → `{ challengeId, nonce, expiresAt }`. Single use, bound to that subject and key. |
| `POST /api/v1/keys/:subjectId` | Add a key: `{ challengeId, key, proofOfPossession, authorization }`. |
| `POST /api/v1/keys/:subjectId/:publicKey/status` | Retire or revoke: `{ challengeId, status, reason, authorization }`. |

Writes never need a password or session. Two signatures do the work:

- **Proof of possession** – the *new* key signs
  `{ purpose: "peers-key-proof", subjectId, publicKey, nonce }`.
- **Authorization** – a key that is already active for the subject signs
  `{ purpose: "peers-key-authorization", subjectId, publicKey, nonce }` (add)
  or `{ purpose: "peers-key-status", subjectId, publicKey, status, reason, nonce }`
  (status change). A key may revoke itself.

Both are `ISignedObject`s from `signObjectWithSecretKey` in
`@peers-app/peers-sdk`. A challenge is consumed by the first attempt that uses
it, so a failed request has to start again.

**First key.** A user with no keys yet registers its first key simply by
proving possession; this is what a device does when it connects to
`peers-services` for the first time. Packages, groups, and devices cannot
self‑register their first key: an operator seeds it, after which the normal
authorization rule applies.

## How peers-services uses it

- Signing in (`/api/v1/auth/authenticate`) and the Socket.IO connection accept
  **any** active key of the user and refuse a revoked one.
- `/api/v1/auth/register` reports `already_registered` for a key the registry
  knows and asks you to add an unknown key through the registry instead.
- The legacy per‑user record keeps a copy of the newest active key so older
  readers see a rotation immediately.

## The peers-core publisher key

The system package `peers-core` is signed by a publisher key whose public half
ships inside every host (`peersCorePublishPublicKey` in `@peers-app/peers-sdk`)
and is pinned on first install. The SDK also carries
`peersCoreRevokedPublishPublicKeys`, an append‑only list of publisher keys that
must never be trusted again:

- A version signed by a revoked key never verifies, whether it arrives from the
  update server or from another group on the mesh.
- A client whose pinned peers-core key has been revoked re‑pins to the current
  key on startup and before each remote update check, then accepts releases
  signed by the new key.
- Hosts that predate a rotation keep the old pin and reject the new releases
  until they update; they are never dual‑signed with a revoked key.

The registry mirrors this: the `peers-core` package ID is a subject whose old
key is `revoked:compromised` and whose current key is `active`. See
[Releasing](./Releasing.md#signing-key) for how the key is generated, stored,
and rotated.

## What is coming

The registry is the foundation for user key rotation. Devices will cache
registry records, peers will accept a signed "key A is succeeded by key B"
attestation in the handshake so a rotation works offline, Identity › Account
will offer *Rotate key* and *Report compromised*, and an optional passwordless
`peers.app` account (verified email, passkeys) will act as a recovery
authority when every device is lost. Until then, the registry is used by the
service itself and by the peers-core trust anchor.

See also [Key Transfer & Recovery](../Roadmap/key-transfer-and-recovery.md)
and [Device-Specific Keys](../Roadmap/device-keys.md).
