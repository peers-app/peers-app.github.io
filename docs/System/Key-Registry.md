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
| Veto | 404, the wrong user, a document that omits the key, or a body that is not a document (including one over the size cap) |
| Abstain | timeout, network error, a redirect, a 408 or 429, or a 5xx |

The presented key is confirmed only when at least one anchor confirms and
none veto. Any veto refuses it. No anchors, or every anchor abstaining,
leaves the change pending. A confirmed key whose `authorizedBy` is a valid
co-signature by the key on record is a **rotation** and replaces the personal
row immediately. A confirmed key without that co-signature is a **recovery**.
Peers wait 72 hours from when they first saw it, then adopt it if nobody who
holds the key on record has contested it. A contest is a signed statement
posted to `POST /api/v1/account/contest` and listed by
`GET /api/v1/account/contest?userId=`. The registry accepts it from an active
key or from the key the recovery retired as lost; a key its holder rotated
away from, or a revoked key, cannot contest. It stays pending until a peer
accepts the new key. A key that is no longer on the personal row is not accepted.

An anchor list changes the same way. The anchors already on record must
publish the new list: one confirming document and no veto. peers-services
stores that list when an anchor-write session `POST`s
`/api/v1/account/anchors`. Until a user sets one, a user document lists this
registry itself. An empty stored list is an opt-out. A browser that cannot
fetch an arbitrary https anchor reads it through
`GET /api/v1/account/anchor-fetch?url=`. That proxy returns the bytes. It does
not decide whether the document is trusted, and it refuses addresses that are
not public https hosts. It maps what it saw onto the three answers: a body
that is not JSON, or one over 64 KiB, returns 422 so the browser vetoes; a
redirect, a timeout, or no answer returns 502 so the browser abstains. Fetching
an `https` anchor directly applies the same bounds: 8 seconds, 64 KiB, and
redirects are not followed.

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
has a key can add a later one only during an anchor-write session opened with
the recovery email (see [Writing to the peers-services anchor](#writing-to-the-peers-services-anchor));
without that session both calls return 403. An operator records a rotation
with the seed tool, passing the previous key's succession signature. Either
write retires the user's previous keys.

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
stored key stays.

Peers refuse a key that any anchor on record vetoes, so a rotation commits
only once **every** anchor on record lists the new key. One holdout changes
nothing: the local key, the wrapped secrets, and the profile row stay as they
were, and the command reports which anchor did not list the key.

`peers keys rotate` (and **Rotate signing key** on Identity → Account) writes
through a writer for each on-record anchor that has one and polls the rest.
The peers-services writer is installed when services are configured. It
accepts the new key only during a short-lived session opened with the recovery
email (see below); without that session the registry refuses the write. An
`https` anchor has no writer, so when one is on record the command first
prints the anchor document, signed by the current key, for you to place at
every `https` anchor on record, then waits until all anchors list the key. A
timeout changes nothing. With services off and no anchors on record, the
command reports that rotation needs an anchor.

`peers keys rotate --manual` writes nowhere. It prints the same document and
polls every anchor on record, including peers-services, which an operator
seeds with `--authorized-by` and `--succession-signature`.

A session write to peers-services replaces the key on record: the previous
keys are retired in the same operation, so the document lists one key and a
device that still presents the old one is refused.

## Writing to the peers-services anchor

Holding the current key does not authorize a write. A user's first key is
still a self-registration. A later key, or a status change, needs a session
whose token carries `scope: anchor-write`. A normal sign-in token does not.

The recovery email lives in `account_auth`, separate from the public key
records. Binding it is signed by a current key, and the one-time code goes to
that mailbox. Opening a session mails a code to the verified address and does
not require the signing key, so the same step is what recovery uses. The
session lasts about ten minutes. A rotation sent during it includes the
previous key's succession signature when the device still holds that key.

Codes are stored as hashes. Production mail goes through Resend when
`RESEND_API_KEY` is set (`PEERS_EMAIL_FROM` overrides the from address,
default `Peers <noreply@peers.app>`). `PEERS_EMAIL_TRANSPORT=console`, or a
missing API key outside production, prints the code instead and keeps the
last one for dev and end-to-end tests. With `NODE_ENV=production` and no
key the service refuses to start rather than fall back to the console, since
that transport serves codes over `/email/last-code`; set the key, or set
`PEERS_EMAIL_TRANSPORT=console` deliberately. That last-code route answers
404 when Resend is the transport. Five wrong codes burn the code, and a code
expires after ten minutes.

A **passkey** opens the same kind of session. Registering one is signed by a
current key; a later assertion needs no key at all, which is what recovery
relies on. Set `PEERS_WEBAUTHN_RP_ID` to the registry's host (for example
`peers.app`) in production: the browser binds the credential to that relying
party, and the server accepts ceremonies only from that host and its
subdomains, plus any exact origins listed in `PEERS_WEBAUTHN_ORIGINS`
(comma-separated, for a dev UI on another host). With `PEERS_WEBAUTHN_RP_ID`
unset the relying party is taken from the request's origin, which is only
acceptable for local development.

Opting out means leaving the mailbox unbound. Peers Services then refuses
every later key. Another anchor you already listed can still confirm a
manual publish. If the signing key is lost and no mailbox is bound, the
account cannot be recovered.

```bash
peers keys email bind --email you@example.com
peers keys email verify --email you@example.com --code 123456
peers keys email session
peers keys email session --code 123456
peers keys rotate
```

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
