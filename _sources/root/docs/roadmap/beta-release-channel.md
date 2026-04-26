# Beta Release Channel

Add a "beta" release channel for both the Electron app (via electron-updater channels) and npm packages (via npm dist-tags), allowing testers to opt into pre-production builds while stable users remain unaffected.

## How It Works

Both systems (Electron auto-update and npm packages) use **semver prerelease tags** as the mechanism. A version like `1.2.3-beta.1` is treated as a beta release everywhere -- no new infrastructure needed.

### Electron App (electron-updater channels)

- Version `1.2.3` -> channel `latest` -> publishes `latest.yml`, `latest-mac.yml`, `latest-linux.yml`
- Version `1.2.3-beta.1` -> channel `beta` -> publishes `beta.yml`, `beta-mac.yml`, `beta-linux.yml`
- Both sets of metadata files live in the same S3 bucket (`peers-electron-app/releases/`)
- On the client, `autoUpdater.channel = 'beta'` makes it check `beta-*.yml` files
- Users on the beta channel **also receive stable updates** if they're newer than the latest beta

### npm Packages (dist-tags)

- `npm publish` -> tagged as `latest` -> `npm install @peers-app/peers-sdk` gets it
- `npm publish --tag beta` -> tagged as `beta` -> `npm install @peers-app/peers-sdk@beta` gets it
- **Critical**: without `--tag beta`, publishing `1.2.3-beta.1` would overwrite the `latest` tag and break all stable consumers

## Changes Required

### 1. Update full-release.js for beta releases

`full-release.js` -- the central change. Add a `--beta` flag:

- **Version generation**: `node full-release.js --beta` takes the current max version (e.g., `1.2.3`), bumps patch, and appends `-beta.1` -> `1.2.4-beta.1`. If `1.2.4-beta.1` already exists, increment to `-beta.2`.
- **npm publish with tag**: In `publishToNpm()`, detect prerelease versions and add `--tag beta`:

```javascript
function publishToNpm(projectPath, packageName, version) {
  const isPrerelease = version.includes('-');
  const tagFlag = isPrerelease ? ' --tag beta' : '';
  execSync(`npm publish${tagFlag}`, { cwd: projectPath, stdio: 'inherit' });
}
```

- **Argument parsing**: Update the arg parsing to accept `--beta` alongside `patch`/`minor`/`major`. A beta release doesn't need a bump type -- it auto-bumps patch and appends the prerelease suffix.

### 2. Update Electron CI to trigger on beta tags

`peers-electron/.github/workflows/build-and-release.yml`:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
      - 'v*.*.*-beta.*'
```

Skip download link updates for beta:

```yaml
update-download-links:
  if: success() && !contains(github.ref, 'beta')
```

### 3. Update npm publish workflows to handle beta tags

The publish workflows in `peers-sdk/.github/workflows/publish.yml` (and equivalents in peers-device, peers-ui) currently do bare `npm publish`. They need to detect beta tags and add `--tag beta`:

```yaml
- name: Publish to npm
  run: |
    if [[ "${{ github.ref }}" == *"beta"* ]]; then
      npm publish --tag beta
    else
      npm publish
    fi
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Also add beta tag patterns to the trigger:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
      - '*.*.*'
      - 'v*.*.*-beta.*'
      - '*.*.*-beta.*'
```

### 4. Update the auto-updater to support channel selection

`peers-electron/src/server/updater.ts` -- read a persisted user preference and set `autoUpdater.channel`:

```typescript
export function checkForUpdatesAndNotify(channel?: string): void {
  const autoUpdater = getAutoUpdater();
  if (channel && channel !== 'latest') {
    autoUpdater.channel = channel;
    autoUpdater.allowPrerelease = true;
  }
  autoUpdater.checkForUpdatesAndNotify();
}
```

Store the channel preference in a JSON config file in `app.getPath('userData')` (simplest) or as a system setting in the database.

### 5. Add a UI setting for users to opt in

Add a toggle/dropdown in the app's settings screen letting users switch between "Stable" and "Beta" channels. When changed, persist the preference and optionally trigger an immediate update check.

## Naming: "beta" vs "insider" vs "preview"

electron-updater supports any channel name -- the channel name becomes the yml file prefix. However, `beta` is the most conventional for both electron-updater and npm dist-tags. You can use `beta` as the technical name but label it "Insider" or "Preview" in the UI.

## Workflow Summary

- **Stable release**: `node full-release.js patch` -> `v1.2.3` -> npm packages tagged `@latest` -> Electron publishes `latest.yml` -> everyone on stable gets it
- **Beta release**: `node full-release.js --beta` -> `v1.2.4-beta.1` -> npm packages tagged `@beta` -> Electron publishes `beta.yml` -> only opted-in users get it
- **Promoting beta to stable**: Do a normal stable release with the same or higher version. Both npm `@latest` and Electron `latest.yml` get updated. Beta users automatically get it too.
