---
sidebar_position: 11
---

# Releasing

`full-release.js` at the monorepo root versions, tests, publishes, and deploys
the packages that ship together. Tasks isn't one of them: it ships on its own
(see [Tasks (peers-core)](#tasks-peers-core)). Run it from the root. Before any release
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

A release takes most of an hour. On macOS the script keeps the Mac from idle-sleeping
until it exits (`caffeinate -i`): on battery an idle Mac sleeps, the e2e devices' timers stall,
and the gate times out. Closing the lid still sleeps the Mac, so leave it open.

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
| `PEERS_CORE_SIGNING_KEY` | `scripts/publish-peers-core.mjs`, which releases Tasks; `full-release.js` doesn't use it (dedicated item, see [Signing key](#signing-key)) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Step 5 electron-builder publish, and the Tasks S3 upload; the IAM user `peers-release-publisher` is limited to the `peers-electron-app` bucket |
| `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD` | Step 5 macOS notarization |

The macOS code-signing certificate comes from the login keychain (`identity`
in `peers-electron/electron-builder.js`). npm publishing uses the login from
`~/.npmrc` (`npm whoami` is checked up front). Windows and Linux installers are
built by the `Build and Release` workflow in `peers-electron` from Actions
secrets when Step 3 pushes the tag.

That workflow builds `peers-sdk`, `peers-device`, `peers-isolate` and
`peers-cli` at the same tag, so a re-run rebuilds the same release. A
re-run also uses the workflow file as it was at that tag. To rebuild a release
with a newer workflow, run it from `main` with the release's version:

```bash
gh workflow run build-and-release.yml -R peers-app/peers-electron -f version=0.30.1
```

## Freezing releases

Create `RELEASES_FROZEN.md` at the monorepo root and in `peers-electron`,
`peers-sdk`, and `peers-ui`, then disable the `Build and Release` and
`Publish to npm` workflows in GitHub (`gh workflow disable`). `full-release.js`,
`publish-peers-core.mjs`, and each repository's `release-guard.js` (run by the
`release:*` scripts, `prepublishOnly`, and the workflows) fail closed while the
marker exists. Lift the freeze with one reviewed commit that removes all four
markers, and re-enable a workflow only after its credentials are confirmed
current. The 2026-10-02 freeze is recorded in
`working/done/release-credential-exposure-incident.md`.

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

## Tasks (peers-core)

`peers-core` is the Tasks app: a sandbox package (declared with `/define`) that keeps
peers-core's package id. Its `npm run build` makes the sandbox bundle
(`dist/package.bundle.js`, which carries the package's manifest), the UI bundle and the
routes bundle.

Tasks ships on its own, apart from the app. `full-release.js` doesn't version, lint,
build, test, freeze, commit, tag, push, or publish it, and its version doesn't count
toward the app's. peers-core's `package.json` version is Tasks' own. Step 2b builds it
only as an e2e fixture, because `peers-headless` installs Tasks from that build.

**No app bundles a copy.** Electron and the PWA install Tasks from S3, or copy it from
another of the user's contexts (see [Where apps get Tasks](#where-apps-get-tasks)).
`peers-headless` still reads the sibling `peers-core/dist`, so the e2e fleet and
`--services-url none` hosts install it offline.

### Releasing Tasks

`scripts/publish-peers-core.mjs` runs peers-core's lint and tests, builds it, signs the
three bundles with the peers-core publisher key (see [Signing key](#signing-key)), and
uploads the tarball and `latest-<tag>.json` to `packages/peers-core/` on S3. The lint and
tests add about three seconds. `--version-tag` is required, and is `beta` or `stable`:

```bash
# Beta: what Tasks ships on while it's reworked. Never freezes contracts.
op run --env-file ~/.config/peers/release.env -- node scripts/publish-peers-core.mjs --version-tag beta

# Stable: only when Mark releases Tasks stable. Check the freeze first. This writes nothing,
# but rebuilds dist (add --skip-build to keep it):
node scripts/publish-peers-core.mjs --version-tag stable --dry-run
op run --env-file ~/.config/peers/release.env -- node scripts/publish-peers-core.mjs --version-tag stable
```

A beta on S3 reaches only the Tasks package rows that follow beta. Every install follows
`stable`, so a group gets an S3 beta only once its package **Info** tab follows
`stable,beta`. During the revamp, Mark's own context gets each beta with
`peers packages promote <versionId> beta --group` instead (see
[Package lifecycle](../Packages/package-lifecycle.md)).

A stable release:

1. Proves it can publish before it writes anything: `PEERS_CORE_SIGNING_KEY` must be the
   current publisher key (not revoked), and the AWS credentials must be there. Both come
   from `op run`, so a freeze only happens after Mark approves the 1Password request. A
   stable release never uses the CLI signing fallback, and refuses `--skip-upload` and
   `--skip-build`.
2. Checks that it names what it ships: a committed peers-core checkout; a version newer
   than S3's current stable and not tagged `tasks-v<version>`, here or on `origin`; and
   `peers-sdk` and `peers-ui` from npm, or linked (`link-deps.js`) to clean checkouts at
   their `v<version>` release tags. A linked checkout's `dist` isn't tracked, so build it
   from that tag.
3. Runs peers-core's lint and tests, builds, then freezes the contract versions the build
   provides: `npx peers-package contract freeze --bundle dist/package.bundle.js`, then
   `npx biome format --write frozen-contracts.json`. **A freeze can't be undone** once
   it's committed and the release is out. If the build changed a contract version an
   earlier stable release froze, the freeze fails, nothing is written or published, and
   the contract needs a new version instead.
4. Signs and uploads `latest-stable.json`. Every new user and every Tasks row that follows
   `stable` gets it. If signing or the upload fails after the freeze, the script says that
   `frozen-contracts.json` was written and nothing was published, and how to undo it
   (`git -C peers-core checkout -- frozen-contracts.json`). Running it again instead
   finishes the release: an uncommitted `frozen-contracts.json` is allowed, and the freeze
   has nothing new to add.
5. Says what's left: commit `frozen-contracts.json`, tag the release `tasks-v<version>`,
   push both, and stage the `peers-core` submodule pointer at the monorepo root.

peers-core's release tags are `tasks-v<version>`, created by hand after a stable publish.
Its older `v<version>` tags came from the app releases that used to carry it. Beta
publishes aren't tagged.

### Where apps get Tasks

Hosts install Tasks with `ensurePeersCore` (`peers-sdk`), into a context that has no
version of it yet:

- **A new group** copies it from the user's personal context or another of their groups,
  then falls back to S3.
- **A new user's personal context** installs the latest stable release from S3 when the app
  starts.
- **Without S3** (an account created offline in the desktop app, or a network that blocks
  the bucket), nothing installs and Tasks is missing from the Apps screen. A failed S3 check
  isn't remembered, so the next check tries again: the automatic update check about a minute
  after the app starts, a new group's install, and each start of the desktop app or load of
  the PWA. A group created meanwhile gets Tasks from the same update check.
- **A dev Electron build** installs the same S3 release. To run the local build instead,
  use `peers packages reload <peers-core id> -c <context>`, as for any package.

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
duration of the command:

```bash
op run --env-file ~/.config/peers/release.env -- node scripts/publish-peers-core.mjs --version-tag beta
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

Typical Azure time is about five to seven minutes, and occasionally over 20,
when Azure copies the bundle file by file. The wait polls `gh run list` for
the just-pushed commit (35 minute timeout) and treats any conclusion other
than `success` as a failed release, with one exception. The deploy installs
the just-published `@peers-app` packages from npm, and a runner can get a 404
for a tarball for a few minutes after it's published. When the failed job's
log shows that, the release waits a minute and reruns the failed job, at
most twice. You need an authenticated `gh` that can read Actions on
`peers-app/peers-services` and rerun its workflow.

The deploy builds `peers-device`, which isn't on npm, from its `v<version>`
tag, using the version in the pushed `peers-services` `package.json`. That's
the same release as the `@peers-app` packages it installs, so a push to
`peers-device` `main` never changes what Services deploys, and a
Services-only push between releases builds the last released `peers-device`.
The Update Download Links workflow builds it the same way.

The deployed bundle leaves out dev dependencies and the files under
`node_modules` the server never loads (source maps, type declarations,
TypeScript sources, docs, and the SQLite C sources), about 68 MB in under
10,000 files. It adds a brotli copy of each PWA and site file, which Services
sends to browsers that accept brotli. Other browsers get gzip.

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

## Desktop update signal

Desktop apps treat the version `peers-services` reports as the newest release
(see [How devices hear about a release](./App-Updates.md#how-devices-hear-about-a-release)).
Each release therefore depends on two things:

- `full-release.js` keeps the `peers-services` version in lockstep with
  `peers-electron`. Do not bump `peers-services` on its own: desktop apps
  would treat the new version as a release and check the S3 feed for up to 24
  hours. The cost is small, but it is pointless.
- `peers-services` deploys before the installers reach S3. Devices see the new
  version within minutes, retry the feed while it lags, and pick up each
  platform's installer within about an hour of its upload.

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

Step 4b does the same for `peers-package-template`, which `peers packages create` clones from
its `main` branch: `@peers-app/peers-sdk` and `@peers-app/peers-ui` become the release version
(peer ranges `^<version>`). Commit template source changes **locally**, on `main`, before
running the release. Before it publishes anything, the release checks that the template is on
`main` with a clean working tree and fast-forwards it; Step 4b checks again. After Step 2's
builds, the release checks a copy of the committed files with real ids against this release's
SDK and peers-ui, packed from those builds: installed, linted, built, and tested. A template
that no longer builds or passes its tests stops the release there, before anything is
published. Step 4b repeats that check with both installed from npm, as a new package gets
them, commits the dependency pin in `package.json`, then pushes `main`, including any local
template commits. The dependency pin stays unchanged until the checks pass, so a failed or
interrupted check can be retried. If the template changes during validation, retry the release
with its source committed and its tree clean. Pushing it after npm publish means a new package
never asks for an SDK that isn't on npm yet; don't push template changes that need an unreleased
SDK before a release.

If either sync fails, the release stops before the later publish steps. A
repeat of the same version skips the commit when those manifests are already
pinned.

After `npm publish`, Step 3 waits for the version to be served before the next repo installs it:
npm must list the version and its tarball must download. npm scans new versions first ("Your
package is being processed and may take a few minutes to become available"), which has taken up
to about 25 minutes, so the wait allows 45. If a release
stops partway through Step 3, run it again without a release type (`npm run release`): it keeps the
version, skips packages already on npm after tagging and pushing their release commits, and
carries on from the first repo it hadn't finished.

Steps 3 and 4 replace the local `@peers-app/*` links with registry installs,
because the published builds and the desktop installer must use them. Step 6
runs `link-deps.js --host-only` after Step 5 to put the links back; a release
that aborts after Step 3 starts relinks on exit too. Without the links, the dev
checkout loads two copies of `@peers-app/peers-sdk`: the dev app reports no
isolated package runtime, and the Tier 1 e2e scenarios fail. If the relink
fails, the script says so; run `node link-deps.js` before using the dev app or
running e2e.

If Step 5 fails (notarization refused with HTTP 403 means Apple wants a new
developer agreement signed), everything else is already published, so re-run
only that step. By then the abort has put the links back, and
`yarn release:local` must not run against them: `peers-device`'s
`npm rebuild` follows the link into `peers-sdk` and fails in its esbuild, and
the installer would bundle the links instead of the registry packages. First
put the registry installs back in the repos the Mac build compiles: in each of
`peers-isolate`, `peers-device`, `peers-ui`, `peers-cli`, and
`peers-electron`, delete the `node_modules/@peers-app/peers-sdk` and
`node_modules/@peers-app/peers-ui` links, then run `npm install --force`.
Then build with the release secrets loaded, and relink whether it succeeds or
not:

```bash
cd peers-electron
op run --env-file ~/.config/peers/release.env -- yarn release:local
cd .. && node link-deps.js --host-only
```

Without `op run`, the build has no Apple or AWS credentials, so it can neither
notarize nor publish.

Official packages (`official-packages/`) are not part of this release. Each
one is versioned, built, and promoted on its own through the package
[lifecycle](../Packages/package-lifecycle.md) (dev, then Promote to beta or
stable). A host release does not version them or bump their `@peers-app/*`
pins, with one exception. Electron's release workflow builds `isolation-smoke`
and `isolation-consumer` from `official-packages` main with `npm ci`. So Step 3
pins those two to the SDK and peers-ui it just published, then pushes
`official-packages`, just before it pushes `peers-electron`'s tag. The release
checks first that `official-packages` is on main and that those two fixtures'
`package.json` and `package-lock.json` have no local changes.

Step 2b still builds `isolation-smoke`,
`isolation-consumer`, and `timers` so the Tier 1 package and scheduler scenarios
can install them; that build does not commit or publish those packages. It first
builds `peers-core` the same way, before the `peers-headless` tests, since headless
hosts install Tasks from that build.
The two isolation fixtures build their guest API 3 declarations with
`peers-package build` through `npm run build`, as do the isolate test-artifact
builder and Electron's release workflow. Keep their SDK build dependency and
`esbuild` installed when preparing a fresh checkout.

## After the script

1. Check the published npm packages (`npm view <package-name>`).
2. Check the desktop artifacts (electron-builder / S3).
3. Confirm `https://peers.app` is the just-released `peers-services`. Running
   desktop apps start checking for the new version as soon as it is.
4. Commit the `peers-headless` and `peers-package-template` submodule pointers at the
   monorepo root (`git add peers-headless peers-package-template && git commit`).
