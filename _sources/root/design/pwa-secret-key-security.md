# PWA Secret Key Security

## Problem

The PWA stores the user's Ed25519 secret key as a plaintext base64url string in `localStorage`. This key is the user's entire cryptographic identity — used for Ed25519 signing, X25519 box encryption (via ed2curve), and XSalsa20-Poly1305 symmetric encryption (first 32 bytes as secretbox key). Anyone who obtains it can fully impersonate the user.

Current implementation (`peers-pwa/src/secret-key.ts`):

```typescript
localStorage.setItem('peers-pwa:secretKey', secretKey);
localStorage.setItem('peers-pwa:userId', userId);
```

Plaintext in localStorage is readable by dev tools, browser extensions, XSS, or anyone who copies the browser profile.

## Approach: Non-extractable AES-GCM wrapping key in IndexedDB

Generate a non-extractable AES-GCM `CryptoKey` via Web Crypto API. Store it in IndexedDB (which supports structured-clone of CryptoKey objects). Use it to encrypt the Ed25519 secret key at rest. The plaintext key only exists in JS memory during an active session.

### Why not use Web Crypto for the actual crypto ops?

The entire crypto layer (peers-sdk/src/keys.ts) is built on TweetNaCl, which requires raw key bytes. We can't use non-extractable CryptoKeys directly for sign/box/secretbox operations. Web Crypto now supports Ed25519 (Chrome 137+, Firefox 129+, Safari 17+) and X25519, but XSalsa20-Poly1305 has no Web Crypto equivalent, so migrating is a larger effort for the future.

### What is stored in IndexedDB

- **`wrappingKey`**: A `CryptoKey` object with `extractable: false`. JS cannot call `exportKey()` on it — only `encrypt()`/`decrypt()`.
- **`encryptedSecretKey`**: Ciphertext (ArrayBuffer) + IV (Uint8Array) from `crypto.subtle.encrypt('AES-GCM', wrappingKey, secretKeyBytes)`.
- **`userId`**: Plaintext string (public identifier, not sensitive).

### Flow

**First run / login:**
1. `crypto.subtle.generateKey('AES-GCM', false, ['encrypt', 'decrypt'])` — `false` = non-extractable
2. Store the `CryptoKey` in IDB under key `"wrappingKey"`
3. Encrypt the secret key bytes with AES-GCM + random IV
4. Store `{ iv, ciphertext }` in IDB under key `"encryptedSecretKey"`
5. Store `userId` in IDB under key `"userId"`

**App open:**
1. Read `wrappingKey` and `encryptedSecretKey` from IDB
2. `crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrappingKey, ciphertext)` → raw bytes
3. Re-encode as base64url string (matching what TweetNaCl/peers-sdk expects)
4. Cache in module-level variable so we only decrypt once per session

**Migration:** On first `getUserId()` call, check if `localStorage` has the old `peers-pwa:*` keys. If so, migrate them to the new encrypted IDB store and delete from `localStorage`.

## Security analysis

### What this protects against

- **Storage viewer / dev tools**: Only ciphertext visible, not a copy-pasteable key string.
- **Browser profile copy / disk forensics**: CryptoKey is bound to the origin and browser's internal key store. Can't be used outside that specific browser+origin.
- **Extensions with storage read access**: CryptoKey with `extractable: false` is opaque — extensions see the object but can't extract the raw AES key bytes.
- **Generic XSS that scrapes localStorage**: No localStorage to steal.

### What this does NOT protect against

- **Targeted XSS**: An attacker who understands the IDB schema can call `crypto.subtle.decrypt()` with the stored (non-extractable) wrapping key. `extractable: false` prevents export, not use. Any code in the same origin can use the key for encrypt/decrypt operations.
- **Full browser compromise**: Nothing helps here in any storage model.

### Realistic threat ranking

| Scenario | localStorage (current) | This plan | With future PIN |
|----------|----------------------|-----------|----------------|
| Shoulder surfer opens dev tools | Trivial copy-paste | Blocked | Blocked |
| Malware copies browser profile | Key stolen | Protected | Protected |
| Extension reads storage | Key stolen | Protected | Protected |
| Generic XSS (steal localStorage) | Key stolen | Protected | Protected |
| Targeted XSS (knows IDB schema) | Key stolen | Vulnerable | Protected (needs PIN) |

Overall: roughly equivalent to what mobile apps achieve with platform keystores in practice, minus hardware-backed isolation.

## Future: Optional PIN layer

To close the targeted-XSS gap, derive the wrapping key from `PBKDF2(PIN, salt)` instead of storing it directly in IDB. The architecture above supports this cleanly — swap the stored CryptoKey for a PBKDF2-derived one. The user enters a PIN on app open; without the PIN, the wrapping key can't be reconstructed and the ciphertext is useless.

## Future: Migrate to Web Crypto native ops

Ed25519 sign/verify is now in SubtleCrypto (Chrome 137+, Firefox 129+, Safari 17+). X25519 key agreement is in Chrome 133+. A longer-term migration from TweetNaCl to Web Crypto would allow truly non-extractable keys for sign/box operations, but XSalsa20-Poly1305 (secretbox) has no Web Crypto equivalent, so it would be a partial migration requiring an alternative symmetric cipher (AES-GCM).

## Files to change

- **`peers-pwa/src/secret-key.ts`** — full rewrite
- **`peers-pwa/src/peers-init.ts`** — no changes expected (already calls the same async API)
