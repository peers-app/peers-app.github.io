You’re generating an Ed25519 signing keypair, then you’re reusing the Ed25519 seed bytes as the input to X25519 (nacl.box) by calling fromSecretKey(secretKeyPart).

A few key points:

1) nacl.sign.keyPair() is Ed25519 (signing)

TweetNaCl’s sign.keyPair() returns a 64-byte secretKey that is effectively:
	•	first 32 bytes = seed
	•	last 32 bytes = public key

That matches your comments and your hydrateKeys() logic.  ￼

2) nacl.box is X25519 (DH), and your derivation is not the standard conversion

nacl.box.keyPair.fromSecretKey() expects a 32-byte X25519 secret scalar (TweetNaCl clamps internally), but feeding it the Ed25519 seed bytes is not the canonical Ed25519→X25519 conversion.  ￼

So what you get is:
	•	deterministic (same Ed seed ⇒ same box key)
	•	likely “works” functionally
	•	but non-standard and creates an unnecessary coupling between your signing identity and your encryption key.

3) What you probably want instead: a real Ed25519 → X25519 conversion

If your goal is “one identity seed → derive both signing + box keys deterministically”, do it using the well-known conversion (libsodium implements this directly).  ￼

Easiest in JS with TweetNaCl: use ed2curve

ed2curve-js exists specifically for TweetNaCl and converts Ed25519 keys to Curve25519/X25519 keys.  ￼

Example refactor:

import nacl from "tweetnacl";
import ed2curve from "ed2curve";
import { encodeBase64, decodeBase64 } from "./base64";

export function newKeys(): IPublicPrivateKeys {
  const sign = nacl.sign.keyPair(); // Ed25519

  const curveSecret = ed2curve.convertSecretKey(sign.secretKey); // 32 bytes
  const box = nacl.box.keyPair.fromSecretKey(curveSecret);       // X25519

  return {
    secretKey: encodeBase64(sign.secretKey),
    publicKey: encodeBase64(sign.publicKey),
    publicBoxKey: encodeBase64(box.publicKey),
  };
}

export function hydrateKeys(secretKey: string): IPublicPrivateKeys {
  const sk64 = decodeBase64(secretKey); // Ed25519 64-byte secretKey

  const curveSecret = ed2curve.convertSecretKey(sk64);
  const box = nacl.box.keyPair.fromSecretKey(curveSecret);

  return {
    secretKey: encodeBase64(sk64),
    publicKey: encodeBase64(sk64.slice(32)), // last 32 bytes = Ed25519 pk
    publicBoxKey: encodeBase64(box.publicKey),
  };
}

This keeps your “single stored secretKey” approach, but makes the box keys derived in a standard, compatible way.

⸻

Recommendation (Peers-style)

For Peers identity, I’d treat:
	•	Ed25519 = identity + signatures (events, claims, attestations)
	•	X25519 = session encryption / transport

Deriving X25519 from Ed25519 is fine if you do the known conversion (or use independent keypairs). Feeding the Ed seed directly into nacl.box is the only part I’d change.