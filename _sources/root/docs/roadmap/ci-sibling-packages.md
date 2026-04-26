# CI: Build peers-cli and peers-core for Electron packaging

The `electron-builder.js` config bundles sibling packages as `extraResources`:

```javascript
extraResources: [
  {
    from: "../peers-core/dist",
    to: "bundled-packages/peers-core",
    filter: ["**/*.js"]
  },
  {
    from: "../peers-cli/dist/peers-cli.js",
    to: "cli/peers-cli.js"
  }
],
```

These paths reference sibling repo directories (`../peers-core`, `../peers-cli`) which exist locally in the `peers-app` monorepo but are **not available in the GitHub Actions build environment**. The GHA workflow only checks out `peers-electron`.

We recently added checkout + build steps for `peers-webrtc` (the Go sidecar). The same pattern is needed for these two TypeScript packages.

## What needs to happen

In `.github/workflows/build-and-release.yml`, add steps to checkout and build both packages before the `electron-builder` packaging step:

### peers-core

```yaml
- name: Checkout peers-core
  uses: actions/checkout@v4
  with:
    repository: peers-app/peers-core
    path: _peers-core
    token: ${{ secrets.GITHUB_TOKEN }}  # Use a PAT if repo is private

- name: Build peers-core
  run: |
    cd _peers-core
    npm ci
    npm run build
    # Place dist where electron-builder expects it
    mkdir -p "$GITHUB_WORKSPACE/../peers-core"
    cp -r dist "$GITHUB_WORKSPACE/../peers-core/dist"
```

### peers-cli

```yaml
- name: Checkout peers-cli
  uses: actions/checkout@v4
  with:
    repository: peers-app/peers-cli
    path: _peers-cli
    token: ${{ secrets.GITHUB_TOKEN }}  # Use a PAT if repo is private

- name: Build peers-cli
  run: |
    cd _peers-cli
    npm ci
    npm run build
    # Place dist where electron-builder expects it
    mkdir -p "$GITHUB_WORKSPACE/../peers-cli/dist"
    cp dist/peers-cli.js "$GITHUB_WORKSPACE/../peers-cli/dist/peers-cli.js"
```

## Notes

- Both packages depend on `@peers-app/peers-sdk` (and peers-cli may depend on `@peers-app/peers-device`), so **`npm ci`** resolves those from the lockfile / npm registry.
- If the repos are private, replace `${{ secrets.GITHUB_TOKEN }}` with a PAT that has cross-repo access.
- Consider caching `node_modules` for these packages to speed up CI.
- An alternative approach: publish pre-built dist artifacts to npm and reference them from `node_modules` instead of sibling directories. This would eliminate the need for these checkout+build steps entirely.
