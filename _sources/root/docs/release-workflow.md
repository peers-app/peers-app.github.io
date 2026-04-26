# Peers Release Workflow

This document describes the complete release workflow for all Peers packages and applications.

**Package manager:** Examples use **npm** (`package-lock.json`). The only app submodule that may still use **`yarn.lock`** is **`peers-react-native`**, which is **currently on hold** (the PWA is the active mobile target) and is not part of the `full-release.js` flow.

## Table of Contents

1. [Overview](#overview)
2. [Package Dependencies](#package-dependencies)
3. [Release Order](#release-order)
4. [Quick Release Guide](#quick-release-guide)
5. [Detailed Release Process](#detailed-release-process)
6. [First-Time Setup](#first-time-setup)
7. [Troubleshooting](#troubleshooting)

## Overview

The Peers project consists of multiple packages that depend on each other:

- **@peers-app/peers-sdk**: Core SDK with data models and utilities
- **@peers-app/peers-device**: Device-specific functionality
- **@peers-app/peers-ui**: React UI components
- **peers-electron**: Desktop Electron application
- **peers-services**: Backend services and landing page

## Package Dependencies

```
@peers-app/peers-sdk (foundation)
    ↓
@peers-app/peers-device (depends on @peers-app/peers-sdk)
    ↓
@peers-app/peers-ui (depends on @peers-app/peers-sdk)
    ↓
peers-electron (depends on all @peers-app packages)
    ↓
peers-services (independent, but hosts download links)
```

## Release Order

**IMPORTANT**: Packages must be released in dependency order. `full-release.js` uses this order:

1. **@peers-app/peers-sdk** — foundation; released first
2. **@peers-app/peers-device** — depends on `peers-sdk`
3. **@peers-app/peers-ui** — depends on `peers-sdk`
4. **peers-cli** — depends on `peers-sdk` (private; tagged only, no npm publish)
5. **peers-core** — depends on `peers-sdk`, `peers-device`, `peers-ui` (private; tagged only)
6. **peers-pwa** — depends on `peers-sdk`, `peers-device`, `peers-ui`, `peers-core`. Its release script builds and copies `dist/*` into `peers-services/public/`, so it **must run before `peers-services`** (private; tagged only)
7. **peers-services** — packages `public/` (including the freshly-copied PWA) and is tagged (private; no npm publish)
8. **peers-electron** — depends on all `@peers-app/*` packages (private; tagged only)

> **peers-react-native** is currently on hold (PWA is the active mobile target) and is **not** part of the release flow. `update-deps.js` still bumps its `@peers-app/*` deps so it doesn't drift while dormant.

## Quick Release Guide

### Standard Release (No Breaking Changes)

```bash
# 1. Release @peers-app/peers-sdk
cd peers-sdk
npm version patch  # 0.1.0 → 0.1.1
git push origin main
git push origin --tags

# 2. Release @peers-app/peers-device (after @peers-app/peers-sdk publishes)
cd ../peers-device
npm version patch  # 0.0.1 → 0.0.2
git push origin main
git push origin --tags

# 3. Release @peers-app/peers-ui (after @peers-app/peers-sdk publishes)
cd ../peers-ui
npm version patch  # 0.0.14 → 0.0.15
git push origin main
git push origin --tags

# 4. Update peers-electron dependencies
cd ../peers-electron
# Update package.json with new versions:
# "@peers-app/peers-sdk": "^0.1.1",
# "@peers-app/peers-device": "^0.0.2",
# "@peers-app/peers-ui": "^0.0.15"
npm install
git add package.json package-lock.json
git commit -m "chore: Update dependencies"
git push

# 5. Release peers-electron
npm version patch  # 0.6.7 → 0.6.8
git push origin main
git push origin --tags

# Done! CI/CD will handle the rest.
```

### Using the release scripts

**`@peers-app/*` libraries** expose **`npm run release`** (defaults to **`release:patch`**), plus **`release:minor`** / **`release:major`**. Each script runs **`npm run build`** (where defined), bumps the version with **`npm version`**, **`git push`**es, and **`git push --tags`** (CI publishes to npm). See each repo’s **`package.json`** → **`scripts`**.

**`peers-electron`** is private; **`npm run release`** only bumps and pushes tags to drive **`build-and-release`** CI. For a local Windows installer build, use **`npm run make:win`**.

```bash
# peers-sdk (example: patch)
cd peers-sdk
npm run release:patch

cd ../peers-device
npm run release:patch

cd ../peers-ui
npm run release:patch

cd ../peers-electron
npm run release
# Local Windows packaging: npm run make:win
```

## Detailed Release Process

### Step 1: Release @peers-app/peers-sdk

@peers-app/peers-sdk is the foundation package. Release it first when you make changes to core models or utilities.

```bash
cd /Users/mark.archer/peers-app/peers-sdk

# 1. Make sure you're on main and up to date
git checkout main
git pull

# 2. Run tests
npm test

# 3. Build the package
npm run build

# 4. Update version (choose one)
npm version patch  # Bug fixes: 0.1.0 → 0.1.1
npm version minor  # New features: 0.1.0 → 0.2.0
npm version major  # Breaking changes: 0.1.0 → 1.0.0

# 5. Push version tag (triggers CI/CD)
git push origin main
git push origin --tags

# 6. Monitor GitHub Actions
# Go to: https://github.com/peers-app/peers-sdk/actions
# Wait for publish to complete
```

**GitHub Actions will**:
- Run tests
- Build the package
- Publish to npm
- Create GitHub release

### Step 2: Release @peers-app/peers-device

After @peers-app/peers-sdk is published to npm, release @peers-app/peers-device.

```bash
cd /Users/mark.archer/peers-app/peers-device

# 1. Update @peers-app/peers-sdk dependency if needed
# Edit package.json peerDependencies:
# "@peers-app/peers-sdk": "^0.1.1"  # Match latest @peers-app/peers-sdk version

# 2. Install dependencies with new peers-sdk
npm install

# 3. Run tests
npm test

# 4. Build the package
npm run build

# 5. Update version
npm version patch  # 0.0.1 → 0.0.2

# 6. Commit dependency updates if any
git add package.json package-lock.json
git commit -m "chore: Update @peers-app/peers-sdk to 0.1.1"

# 7. Push version tag
git push origin main
git push origin --tags

# 8. Monitor GitHub Actions
# Go to: https://github.com/peers-app/peers-device/actions
```

### Step 3: Release @peers-app/peers-ui

After @peers-app/peers-sdk is published, release @peers-app/peers-ui.

```bash
cd /Users/mark.archer/peers-app/peers-ui

# 1. Update @peers-app/peers-sdk dependency if needed
# Edit package.json peerDependencies:
# "@peers-app/peers-sdk": "^0.1.1"

# 2. Install dependencies
npm install

# 3. Run tests
npm test

# 4. Build the package
npm run build

# 5. Update version
npm version patch  # 0.0.14 → 0.0.15

# 6. Commit dependency updates if any
git add package.json package-lock.json
git commit -m "chore: Update @peers-app/peers-sdk to 0.1.1"

# 7. Push version tag
git push origin main
git push origin --tags

# 8. Monitor GitHub Actions
# Go to: https://github.com/peers-app/peers-ui/actions
```

### Step 4: Release peers-electron

After all dependencies are published, release peers-electron.

```bash
cd /Users/mark.archer/peers-app/peers-electron

# 1. Update all dependencies
# Edit package.json dependencies:
# "@peers-app/peers-sdk": "^0.1.1",
# "@peers-app/peers-device": "^0.0.2",
# "@peers-app/peers-ui": "^0.0.15"

# 2. Install dependencies
npm install

# 3. Build and test locally (optional)
npm run build
npm start

# 4. Commit dependency updates
git add package.json package-lock.json
git commit -m "chore: Update dependencies to latest versions"
git push

# 5. Update version
npm version patch  # 0.6.7 → 0.6.8

# 6. Push version tag (triggers CI/CD)
git push origin main
git push origin --tags

# 7. Monitor GitHub Actions
# Go to: https://github.com/peers-app/peers-electron/actions
# Wait for all platform builds to complete
```

**GitHub Actions will**:
- Build for macOS, Linux, and Windows
- Publish installers to S3
- Update download links in peers-services
- Upload build artifacts

### Step 5: Verify peers-services

The peers-electron CI/CD automatically updates the download links, but verify:

```bash
cd /Users/mark.archer/peers-app/peers-services

# 1. Pull latest changes
git pull

# 2. Check that download.html was updated
git log -1 --oneline public/download.html

# 3. Verify the links are correct
# Should see: chore: Update download links to latest versions [skip ci]

# 4. Manually update if needed
npm run update-app-urls
```

## First-Time Setup

### npm Authentication

Each repository needs an npm token configured as a GitHub Secret.

#### Creating npm Token

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Go to **Account Settings** → **Access Tokens**
3. Click **Generate New Token**
4. Select **Automation** token type
5. Copy the token (starts with `npm_`)

#### Adding npm Token to GitHub

For each repository (peers-sdk, peers-device, peers-ui):

1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `NPM_TOKEN`
4. Value: Paste your npm token
5. Click **Add secret**

### Repository Access

Ensure you have:
- **Write** access to all repositories
- **npm** publish access for peers-sdk, peers-device, peers-ui
- **AWS** credentials for peers-electron S3 publishing (see [peers-electron deployment docs](peers-electron/docs/deployment.md))

## Troubleshooting

### npm Package Not Found

**Problem**: `npm install` fails with "package not found"

**Solution**:
1. Check that previous package published successfully
2. Wait a few minutes for npm registry to sync
3. Clear npm cache: `npm cache clean --force`
4. Try again: `npm install`

### Version Conflict

**Problem**: Dependency version doesn't match published version

**Solution**:
```bash
# Check published version
npm view @peers-app/peers-sdk version

# Update package.json to match
# Then run
npm install
```

### CI/CD Publish Fails

**Problem**: GitHub Actions publish job fails

**Check**:
1. **npm Token**: Verify `NPM_TOKEN` secret is configured
2. **Token Permissions**: Ensure token has automation/publish scope
3. **Package Name**: Check package name isn't taken on npm
4. **Version Conflict**: Can't publish same version twice

**Solution**:
- Review GitHub Actions logs
- Fix the issue
- Bump version again: `npm version patch`
- Push new tag: `git push origin --tags`

### peers-electron Build Fails

**Problem**: peers-electron can't find dependency

**Check**:
1. Verify all dependencies are published to npm
2. Check package.json has correct versions
3. Clear node_modules: `rm -rf node_modules && npm install`

**Solution**:
```bash
# Verify dependencies exist on npm
npm view @peers-app/peers-sdk version
npm view @peers-app/peers-device version
npm view @peers-app/peers-ui version

# Update peers-electron package.json
# Then reinstall
npm install
```

### Breaking Changes

**Problem**: New version breaks dependent packages

**Solution**:
1. **Use Semantic Versioning**: Major version for breaking changes
2. **Update Dependents**: Update all dependent packages after breaking change
3. **Test Before Release**: Test integration locally before publishing

```bash
# For breaking changes, use major version bump
npm version major  # 0.1.0 → 1.0.0

# Update all dependent packages
cd peers-device
# Update package.json: "@peers-app/peers-sdk": "^1.0.0"
npm install
# Test thoroughly
npm test

cd peers-ui
# Update package.json: "@peers-app/peers-sdk": "^1.0.0"
npm install
npm test

cd peers-electron
# Update all dependencies
npm install
npm test
```

## Version Strategy

### Semantic Versioning

All packages follow [Semantic Versioning](https://semver.org/):

- **Patch** (0.0.1 → 0.0.2): Bug fixes, no API changes
- **Minor** (0.0.1 → 0.1.0): New features, backward compatible
- **Major** (0.0.1 → 1.0.0): Breaking changes

### Pre-releases

For beta/alpha versions:

```bash
# Create pre-release
npm version prerelease --preid=beta  # 0.0.1 → 0.0.2-beta.0

# Publish with beta tag
npm publish --tag beta

# Install beta version
npm install @peers-app/peers-sdk@beta
```

### Version Synchronization

It's not necessary to keep all package versions in sync. Each package has its own version number:

- **@peers-app/peers-sdk**: 0.1.0
- **@peers-app/peers-device**: 0.0.2
- **@peers-app/peers-ui**: 0.0.15
- **peers-electron**: 0.6.8

Only bump versions when that specific package changes.

## Best Practices

### 1. Test Before Release

Always run tests before publishing:

```bash
npm test
```

### 2. Build Locally First

Test the build locally:

```bash
npm run build
```

### 3. Use release scripts

For **`@peers-app/*`** packages, use **`npm run release:patch`** (or **`release:minor`** / **`release:major`**) so build + version bump + push happen together (see [Using the release scripts](#using-the-release-scripts)).

### 4. Monitor CI/CD

Always check that CI/CD completes successfully:
- Check GitHub Actions logs
- Verify package appears on npm
- Test installation: `npm view <package-name>`

### 5. Keep Dependencies Updated

Regularly update dependencies:

```bash
# Check for outdated dependencies
npm outdated

# Apply semver-safe updates from package.json ranges
npm update

# Optional: inspect or bump ranges interactively, then reinstall
# npx npm-check-updates -i && npm install
```

### 6. Document Changes

Use conventional commits:

```bash
git commit -m "feat: Add new feature"
git commit -m "fix: Fix bug"
git commit -m "chore: Update dependencies"
git commit -m "docs: Update documentation"
```

## Release Checklist

Use this checklist for each release:

### peers-sdk Release

- [ ] Tests passing
- [ ] Build successful
- [ ] Version bumped
- [ ] Changes documented
- [ ] Tag pushed
- [ ] CI/CD succeeded
- [ ] Package on npm
- [ ] GitHub release created

### peers-device Release

- [ ] peers-sdk dependency updated
- [ ] Tests passing
- [ ] Build successful
- [ ] Version bumped
- [ ] Tag pushed
- [ ] CI/CD succeeded
- [ ] Package on npm

### peers-ui Release

- [ ] peers-sdk dependency updated
- [ ] Tests passing
- [ ] Build successful
- [ ] Version bumped
- [ ] Tag pushed
- [ ] CI/CD succeeded
- [ ] Package on npm

### peers-electron Release

- [ ] All dependencies updated
- [ ] Dependencies installed
- [ ] Local build tested
- [ ] Version bumped
- [ ] Tag pushed
- [ ] CI/CD succeeded (all platforms)
- [ ] Installers in S3
- [ ] Download links updated
- [ ] Installation tested

## Related Documentation

- [peers-electron CI/CD Pipeline](peers-electron/docs/ci-cd-pipeline.md)
- [peers-electron Deployment Guide](peers-electron/docs/deployment.md)
- [Download Links Management](peers-services/docs/download-links.md)

## Support

For release issues:

1. Check this documentation
2. Review GitHub Actions logs
3. Check npm package status
4. Open an issue in the respective repository

## Change Log

- **2026-04-22**: Phase 3.3 — npm-first examples (`npm install`, `package-lock.json`, **`npm run release`**, **`npm outdated`** / **`npm update`**); note **`peers-react-native`** may still use Yarn until migrated.
- **2024-10-22**: Initial release workflow documentation
  - Documented complete release process
  - Added npm publishing workflows for all packages
  - Established dependency order
  - Created troubleshooting guide
