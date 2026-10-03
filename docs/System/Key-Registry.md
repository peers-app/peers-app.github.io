---
sidebar_position: 12
title: Key Registry
---

# Key Registry

A **key registry** is one kind of **identity anchor**. An anchor publishes
which public key is a user's current key. `peers.app` runs the default
anchor as part of `peers-services`. A user can also name an `https` URL that
serves the same document. Everything that works without `peers-services`
keeps working with an empty anchor list: peers simply have no outside
confirmation, so a different key stays untrusted.

The registry stores only public keys and signatures. It never holds secret
keys, password hashes, or recovery codes. Holding the current key proves you
can speak as that key. It does not let you replace it.

## The anchor document

`GET /api/v1/keys/:subjectId` returns a document signed by the registry
(`{ contents, signature, publicKey }`). An `https` anchor serves the same
`contents`, with or without that envelope.

| Field | Meaning |
|---|---|
| `version` | `1` |
| `userId` | the Peers ID the document is about |
| `keys` | keys that are active right now, oldest first. A listed key is current. Retired and revoked keys are omitted |
| `keys[].issuedAt` | when that key was registered |
| `keys[].authorizedBy` | `{ publicKey, signature }` when the previous key co-signed the succession statement. Present means a rotation; absent means a recovery |
| `anchors` | where else to look. A user document defaults to this registry's own URL. A package, group, or device document lists none |
| `updatedAt` | when the registry signed the document |

The succession statement the previous key signs is
`{ purpose: "peers-key-succession", userId, publicKey, issuedAt }`, where
`publicKey` is the new key. `authorizedBy.publicKey` is the previous key and
`authorizedBy.signature` is its signature over that statement.

Responses send `Cache-Control: public, max-age=60`. A peer keeps a confirmed
answer for that long, or for the shortest `max-age` it was given.

## How a peer decides

A peer resolves a new key against the anchors **already stored** for that
user (the on-record list, on the personal `Users` row). A list that arrives
with the new key is ignored. So is a synced `Users` row that tries to change
`publicKey` or `anchors` for someone else: the row is not written until the
anchors on record confirm the key, and a replacement anchor list is never
taken from that row.

Each anchor answers in one of three ways:

| Answer | When |
|---|---|
| Confirm | the document is for this user and lists the presented key |
| Veto | 404, the wrong user, a document that omits the key, or a body that is not a document |
| Abstain | timeout, network error, or a 5xx |

The presented key is confirmed only when at least one anchor confirms and
none veto. Any veto refuses it. No anchors, or every anchor abstaining,
leaves the change pending. A confirmed key whose `authorizedBy` is a valid
co-signature by the key on record is a **rotation** and replaces the personal
row immediately. A confirmed key without that co-signature is a **recovery**
and stays pending until a recovery delay exists. A key that is no longer on
the personal row is not accepted.

## API

Base path: `https://peers.app/api/v1/keys`. Reads are public; everything is
rate limited per IP.

| Call | What it does |
|---|---|
| `GET /.well-known/peers-key-registry.json` | The registry's own ID and signing key. Pin this; every signed read verifies against it. |
| `GET /api/v1/keys/:subjectId` | The anchor document, signed by the registry. |
| `GET /api/v1/keys/:subjectId/:publicKey` | One stored key record, signed, including retired and revoked rows. |
| `POST /api/v1/keys/:subjectId/challenge` | `{ publicKey }` → `{ challengeId, nonce, expiresAt }`. Single use, bound to that subject and key. |
| `POST /api/v1/keys/:subjectId` | Add a key: `{ challengeId, key, proofOfPossession, authorization? }`. |
| `POST /api/v1/keys/:subjectId/:publicKey/status` | Retire or revoke a package, group, or device key: `{ challengeId, status, reason, authorization }`. |

**Proof of possession** – the new key signs
`{ purpose: "peers-key-proof", subjectId, publicKey, nonce }`. That is an
`ISignedObject` from `signObjectWithSecretKey` in `@peers-app/peers-sdk`.
A challenge is consumed by the first attempt that uses it.

**A user's first key** is registered by that proof alone. This is what a
device does the first time it reaches `peers-services`. A user who already
has a key cannot add or retire one over HTTP: both calls return 403. An
operator records a rotation with the seed tool, passing the previous key's
succession signature. An account factor that can do the same write comes
later.

**Packages, groups, and devices** cannot self-register a first key. An
operator seeds it. A later key is authorized by a key that is already active
for that subject, signing
`{ purpose: "peers-key-authorization", subjectId, publicKey, nonce }`. The
same kind of signature, with purpose `peers-key-status`, retires or revokes
it. A user's key is not in that rule.

Stored rows still use `active`, `retired`, and `revoked`. Revoked is final.
The anchor document only lists keys that are active. Signing in
(`/api/v1/auth/authenticate`) accepts an active key and refuses any other.

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

## User key rotation

A different key in a handshake is accepted only when the anchors on record
confirm it as a rotation. Otherwise the handshake is `Untrusted` and the
stored key stays. **Identity → Account** and `peers keys rotate` still say
that rotation needs an anchor that accepts writes: publishing the new key is
the next step, and nothing local changes until an anchor lists it.

What is already in place, so that publish can land without re-encrypting
databases:

- The host credential record stores `dbSecret` separately from `secretKey`.
  New identities mint a random database key. A record that predates the field
  derives it once from the secret key and keeps that value. A later rotation
  keeps `dbSecret` and appends the old public key to `previousPublicKeys`.
- Secret persistent variables can be re-wrapped from the old signing key to
  the new one before anything is written.
- A new user whose services URL is configured starts with one on-record
  anchor, the peers-services document for their user id. With services off,
  the list is empty.
- `peers keys show` and the Signing key card report the current key, previous
  keys, and what the registry lists when it can be reached.

An operator records a rotation the registry will not accept over HTTP:

```bash
node dist/keys/seed-subject-key.js \
  --subject <userId> --type user \
  --public-key <new base64url> --status active \
  --issued-at <ISO> \
  --authorized-by <previous publicKey> \
  --succession-signature <sig>
```

The signature is checked before it is stored. A signature that does not
verify is refused.
