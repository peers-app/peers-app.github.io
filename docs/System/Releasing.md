---
sidebar_position: 11
---

# Releasing

`full-release.js` at the monorepo root versions, tests, publishes, and deploys
the packages that ship together. Run it from the root. Before any release
mutation or external login check, the script runs the current-tree and history
secret scans, then runs `npm whoami` against the registry `npm publish` will use.
It aborts if either scan fails or the npm login is missing or rejected. `gh`
must be able to see `peers-app/peers-services`:

```bash
npm run release            # keep the current version
npm run release -- patch  # or minor / major
```

`npm run release` runs `scripts/release.sh`, which injects
`~/.config/peers/release.env` through `op run` for that process. 1Password
still asks you to approve the request. The arguments after `--` are passed to
`full-release.js`.

## Release credentials

No release step reads a `.env` file inside a repository. Every credential is
injected into the process environment for the duration of the command by the
[1Password CLI](https://developer.1password.com/docs/cli/secrets-environment-variables)
and resolved only when the 1Password app approves the request. The env file
holds `op://` references and non-secret identifiers, never values, so it is
safe to leave on disk:

```bash
# ~/.config/peers/release.env
PEERS_CORE_SIGNING_KEY="op://<vault>/<peers-core publisher item>/credential"
AWS_ACCESS_KEY_ID="op://<vault>/<peers-release-publisher item>/access key id"
AWS_SECRET_ACCESS_KEY="op://<vault>/<peers-release-publisher item>/secret access key"
APPLE_ID="<apple id email>"
APPLE_TEAM_ID="<team id>"
APPLE_APP_SPECIFIC_PASSWORD="op://<vault>/<notarization item>/password"
```

| Variable | Used by |
|---|---|
| `PEERS_CORE_SIGNING_KEY` | Step 5, `scripts/publish-peers-core.mjs` (dedicated item, see [Signing key](#signing-key)) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Step 5 S3 upload and Step 6 electron-builder publish; the IAM user `peers-release-publisher` is limited to the `peers-electron-app` bucket |
| `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD` | Step 6 macOS notarization |

The macOS code-signing certificate comes from the login keychain (`identity`
in `peers-electron/electron-builder.js`). npm publishing uses the login from
`~/.npmrc` (`npm whoami` is checked up front). Windows and Linux installers are
built by the `Build and Release` workflow in `peers-electron` from Actions
secrets when Step 3 pushes the tag.

## Freezing releases

Create `RELEASES_FROZEN.md` at the monorepo root and in `peers-electron`,
`peers-sdk`, and `peers-ui`, then disable the `Build and Release` and
`Publish to npm` workflows in GitHub (`gh workflow disable`). `full-release.js`,
`publish-peers-core.mjs`, and each repository's `release-guard.js` (run by the
`release:*` scripts, `prepublishOnly`, and the workflows) fail closed while the
marker exists. Lift the freeze with one reviewed commit that removes all four
markers, and re-enable a workflow only after its credentials are confirmed
current. The 2026-10-02 freeze is recorded in
`working/release-credential-exposure-incident.md`.

Install [Gitleaks](https://github.com/gitleaks/gitleaks) 8.25.0 or newer on the
release machine (`brew install gitleaks` on macOS). `npm run scan:secrets`
scans tracked files and non-ignored untracked files in the root and every
initialized submodule. `npm run scan:secrets:history` scans every repository's
available Git history. CI checks out full submodule histories and runs both.

The committed `.gitleaksignore` is an incident baseline, not a declaration that
the listed historical credentials are safe. A new entry requires incident
review and a documented reason; never baseline a new current-tree secret merely
to unblock a release. Generated PWA bundles at `public/assets/index-*.js` are
allowlisted in `.gitleaks.toml`: they are build output, and `generic-api-key`
matches minified expressions such as `anchor.key`. The PWA source is still
scanned. The Electron release workflow independently scans its
archived source tree before any platform build can publish.

Cross-repository Actions access is split by operation. `PEERS_REPOS_READ_TOKEN`
has only **Contents: read** on explicitly selected private dependency
repositories; the root secret scan needs that read access across all
submodules. `PEERS_SERVICES_WRITE_TOKEN` has **Contents: read and write** on
`peers-services` only and is used only by the Electron download-link update.
Workflows running in `peers-services` use their scoped `GITHUB_TOKEN` for
same-repository pushes. Do not restore the former classic full-control PAT.

Electron packaging uses an explicit application-file allowlist: compiled
`bin/`, `public/`, `preload.js`, `package.json`, and production
`node_modules/`. The shared `afterPack` verifier inspects the ASAR and unpacked
native modules and fails if any other top-level path appears, if forbidden
credential/configuration paths appear anywhere, or if required production
modules cannot load. It also reads packaged application text through the ASAR
Node API and rejects literal `SECRET_KEY`, `rootPrivateKey`,
`userPrivateKey`, or `devicePrivateKey` values without writing extracted files
into the repository.

## Signing key

`peers-core` is signed by an Ed25519 publisher key. The public half is
`peersCorePublishPublicKey` in `peers-sdk/src/system-ids.ts` and ships in every
host; the secret half exists only in a dedicated 1Password item, separate from
the AWS, npm, GitHub, Apple, and Azure release credentials, and is never
written to a file in any repository.

**Generate** a key pair with the audited script (requires a built
`peers-sdk`):

```bash
node scripts/generate-publisher-key.mjs            # prints public key and, once, the secret
node scripts/generate-publisher-key.mjs --public-only
```

Paste the secret into the 1Password item and keep only the public key.

**Publish** with the secret injected into the process environment for the
duration of the command (`full-release.js` does this as Step 5; standalone):

```bash
op run --env-file ~/.config/peers/release.env -- node scripts/publish-peers-core.mjs
```

`publish-peers-core.mjs` derives the public key from the secret and aborts
when it does not equal `peersCorePublishPublicKey` or when it appears in
`peersCoreRevokedPublishPublicKeys`.

The signed payload includes `createdBy`. Set `PEERS_CORE_CREATED_BY` (or
`USER_ID`) to record a specific peer; otherwise the peers-core package id is
signed. The installer stores that same value, and a client rejects the version
when it does not match the signature. `0.25.12` and `0.25.13` omitted
`createdBy`; do not add a verifier exception for those historical artifacts.
Publish a newer version with the complete signed payload instead.

**Rotate** when the key is compromised or on schedule:

1. Generate the new pair as above and store the secret in a *new* 1Password
   item.
2. Set `peersCorePublishPublicKey` to the new public key and append the old
   one to `peersCoreRevokedPublishPublicKeys`. Rebuild `peers-sdk` and every
   consumer.
3. Seed the [key registry](./Key-Registry.md) once `peers-services` is
   deployed: `npm run seed-subject-key -- --subject <peersCorePackageId>
   --type package --public-key <old> --status revoked --reason compromised`,
   then the same with `--public-key <new> --status active`.
4. Release the desktop and PWA hosts. Each client re-pins to the new key on
   startup and on its next remote update check.
5. Publish `peers-core` with the new key. Hosts that have not updated reject
   it by design and stay on their current `peers-core`; never dual-sign with
   the revoked key.

## Gates

The script aborts on the first failed gate. Two of those gates exist because
unit tests on a single process cannot see them:

| Gate | When | Bypass |
|---|---|---|
| Step 2b: `peers-headless` tests + `peers-e2e` Tier 0/1 | Before any package is versioned or published | `--skip-e2e` |
| After Step 3 pushes `peers-services`: GitHub Actions `main_peers-services.yml` (build, test, Azure) | Before `peers-electron` is processed | `--skip-services-deploy` |

Both skip flags are for emergency releases only and print a loud warning. The
e2e packages are deliberately not in CI; the Azure workflow *is* CI, and the
release script waits for it so a green local test run cannot ship a client
against a server that never deployed.

Step 2b also runs `make local` in `peers-webrtc` before the Tier 1 scenarios.
The WebRTC scenario skips itself on machines without a sidecar binary, which
is fine on a laptop and wrong on the release machine, so a failed `make local`
(missing Go, missing checkout) aborts the release instead of letting the
scenario quietly skip. The same rule applies to the pairing and invites
scenarios, which run the real `peers-services` (built in Step 2) with an
in-memory Mongo: Step 2b checks `peers-services/dist/server.js` exists and runs
the scenarios with `PEERS_E2E_REQUIRE_SERVICES=1`, so a machine that cannot
start Mongo fails the release rather than skipping the only end-to-end
coverage of device pairing and the invite mailbox. The first run on a new
machine downloads the `mongod` binary (see
[E2E testing](./E2E-Testing.md)).

Typical Azure time is about seven minutes. The wait polls `gh run list` for
the just-pushed commit (20 minute timeout) and treats any conclusion other
than `success` as a failed release. You need an authenticated `gh` that can
read Actions on `peers-app/peers-services`.

## Server first when the verifier changes

New signatures, handshakes, and other objects that `peers-services` must
*accept* are one-way compatible: a new signer plus an old verifier fails, a
new verifier plus an old signer succeeds (or falls back). The 0.25.0
canonical-JSON signature change shipped a client that `peers.app` rejected
until a later CI fix deployed the matching server.

Rules of thumb:

- Put the new verifier on `peers-services` and wait for Azure to finish
  (`full-release.js` does this wait) before releasing any client that produces
  the new bytes.
- Keep a legacy verify fallback in `@peers-app/peers-sdk` until you are sure
  no pre-change clients remain; do not treat that fallback as permanent.
- Do not announce a desktop or npm client until `https://peers.app` is running
  the commit you just pushed.

## Dependency sync

After every release repo is published, Step 4 pins `peers-headless` to the
version just published. Step 1 only sees versions already on npm, so this pass
is what moves that consumer forward. Step 1 itself runs `update-deps.js` and
`link-deps.js` with `--host-only`, so official package manifests are left
alone.

`peers-headless` gets `@peers-app/peers-sdk` set to the release version. The
script fast-forwards that repo, installs from the registry, then lints,
builds, and tests. It commits and pushes only `package.json` and
`package-lock.json` inside the `peers-headless` repo. Its own version stays
`0.1.0`. It is not tagged or published.

If that sync fails, the release stops before the later publish steps. A
repeat of the same version skips the commit when those manifests are already
pinned.

Official packages (`official-packages/`) are not part of this release. Each
one is versioned, built, and promoted on its own through the package
[lifecycle](../Packages/package-lifecycle.md) (dev, then Promote to beta or
stable). A host release does not bump their `@peers-app/*` pins or push the
`official-packages` repo. Step 2b still builds `isolation-smoke` and
`isolation-consumer` so the Tier 1 packages scenario can install them; that
build does not commit or publish those packages.

## After the script

1. Check the published npm packages (`npm view <package-name>`).
2. Check the desktop artifacts (electron-builder / S3).
3. Confirm `https://peers.app` is the just-released `peers-services`.
4. Commit the `peers-headless` submodule pointer at the monorepo root
   (`git add peers-headless && git commit`).
