---
sidebar_position: 11
---

# Releasing

`full-release.js` at the monorepo root versions, tests, publishes, and deploys
the packages that ship together. Run it from the root. Before any other work,
the script runs `npm whoami` against the registry `npm publish` will use and
aborts if that login is missing or rejected. `gh` must be able to see
`peers-app/peers-services`:

```bash
node full-release.js          # keep the current version
node full-release.js patch    # or minor / major
```

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

After every release repo is published, Step 4 pins consumers that are not in
the release repo list. Step 1 only sees versions already on npm, so this pass
is what moves them to the version just published.

- `peers-headless` gets `@peers-app/peers-sdk` set to the release version. The
  script fast-forwards that repo, installs from the registry, then lints,
  builds, and tests. It commits and pushes only `package.json` and
  `package-lock.json` inside the `peers-headless` repo. Its own version stays
  `0.1.0`. It is not tagged or published.
- Each official package gets the same registry pin for `@peers-app/peers-sdk`
  and `@peers-app/peers-ui`. The script then commits and pushes the
  `official-packages` repo.

If either sync fails, the release stops before the later publish steps. A
repeat of the same version skips the commit when those manifests are already
pinned.

## After the script

1. Check the published npm packages (`npm view <package-name>`).
2. Check the desktop artifacts (electron-builder / S3).
3. Confirm `https://peers.app` is the just-released `peers-services`.
4. Commit the `peers-headless` and `official-packages` submodule pointers at
   the monorepo root (`git add peers-headless official-packages && git commit`).
