# Deployment Guide

This guide covers how to deploy new versions of the Peers Electron application using the automated CI/CD pipeline.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Release Guide](#quick-release-guide)
3. [First-Time Setup](#first-time-setup)
4. [Release Workflow](#release-workflow)
5. [Manual Local Release](#manual-local-release)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

- GitHub repository access with write permissions
- GitHub Secrets configured (see [First-Time Setup](#first-time-setup))
- Git installed locally
- Node.js 20+ installed for local builds

## Quick Release Guide

For regular releases after initial setup:

```bash
# 1. Make sure you're on the main branch
git checkout main
git pull

# 2. Update the version (choose one)
npm version patch  # 0.6.7 → 0.6.8 (bug fixes)
npm version minor  # 0.6.7 → 0.7.0 (new features)
npm version major  # 0.6.7 → 1.0.0 (breaking changes)

# 3. Push the version commit
git push

# 4. Push the version tag (this triggers the CI/CD pipeline)
git push --tags

# 5. Monitor the build in GitHub Actions
# Go to: https://github.com/peers-app/peers-electron/actions
```

That's it! The CI/CD pipeline will:
- Build installers for macOS, Linux, and Windows
- Publish all files to S3
- Update download links on the website
- Upload artifacts for download

## First-Time Setup

### 1. Configure GitHub Secrets

Navigate to: **Repository → Settings → Secrets and variables → Actions**

Add the following secrets:

#### AWS Credentials

| Secret Name | Description | How to Get |
|------------|-------------|-----------|
| `AWS_ACCESS_KEY_ID` | AWS access key ID | AWS IAM Console |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | AWS IAM Console |

**Creating AWS IAM User**:

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Create new user: `peers-electron-ci`
3. Attach policy with S3 permissions (see [ci-cd-pipeline.md](ci-cd-pipeline.md#iam-policy-for-cicd))
4. Create access key and save both ID and secret
5. Add to GitHub Secrets

#### Apple Credentials (macOS Notarization)

| Secret Name | Description | How to Get |
|------------|-------------|-----------|
| `APPLE_ID` | Apple ID email | Your Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | [appleid.apple.com](https://appleid.apple.com) |
| `APPLE_TEAM_ID` | Apple Developer Team ID | [developer.apple.com](https://developer.apple.com/account) |

**Creating App-Specific Password**:

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Navigate to **Security** section
4. Click **App-Specific Passwords**
5. Generate new password with name "peers-electron-ci"
6. Copy the password (format: `xxxx-xxxx-xxxx-xxxx`)
7. Add to GitHub Secrets

**Finding Team ID**:

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. Look for **Team ID** in account summary
3. Add to GitHub Secrets

#### Cross-Repository Access

| Secret Name | Description | How to Get |
|------------|-------------|-----------|
| `PEERS_SERVICES_PAT` | Personal Access Token | [GitHub Settings](https://github.com/settings/tokens) |

**Creating Personal Access Token**:

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Name: "peers-electron CI/CD"
4. Expiration: 90 days (you'll need to rotate it)
5. Scopes: Check **`repo`** (Full control of private repositories)
6. Click "Generate token"
7. Copy the token immediately (starts with `ghp_`)
8. Add to GitHub Secrets

### 2. Verify Workflow File

Ensure `.github/workflows/build-and-release.yml` exists and is on the main branch.

### 3. Test the Setup

Trigger a manual build to verify everything works:

1. Go to **Actions** tab in GitHub
2. Select **Build and Release** workflow
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

Monitor the build and verify:
- All three platform builds succeed
- Files appear in S3 bucket
- Download links are updated on website

## Release Workflow

### Standard Release Process

```bash
# 1. Pull latest changes
git checkout main
git pull origin main

# 2. Make your changes
# ... edit code, fix bugs, add features ...

# 3. Commit changes
git add .
git commit -m "feat: Add new feature"
git push

# 4. Update version
npm version patch  # or minor/major
# This creates a commit and tag automatically

# 5. Push version and tags
git push origin main
git push origin --tags

# 6. Monitor in GitHub Actions
# The workflow is triggered by the version tag
```

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **Patch** (0.6.7 → 0.6.8): Bug fixes, minor changes
- **Minor** (0.6.7 → 0.7.0): New features, backward compatible
- **Major** (0.6.7 → 1.0.0): Breaking changes

### Pre-release Versions

For beta or alpha releases:

```bash
# Create pre-release version
npm version prerelease --preid=beta  # 0.6.7 → 0.6.8-beta.0

# Or manually edit package.json
# "version": "0.6.8-beta.1"

# Commit and push
git add package.json
git commit -m "chore: Bump version to 0.6.8-beta.1"
git tag v0.6.8-beta.1
git push origin main
git push origin v0.6.8-beta.1
```

### Hotfix Release

For urgent fixes to production:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug

# 2. Make the fix
# ... fix the critical bug ...
git commit -am "fix: Critical security patch"

# 3. Merge back to main
git checkout main
git merge hotfix/critical-bug

# 4. Release
npm version patch
git push origin main
git push origin --tags

# 5. Delete hotfix branch
git branch -d hotfix/critical-bug
```

## Manual Local Release

For testing or when CI/CD is unavailable:

### Prerequisites

Create a `.env` file with your credentials:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your credentials
# NEVER commit this file!
```

### Build and Publish

```bash
# 1. Clean previous builds
yarn clean

# 2. Build the application
yarn build

# 3. Build installers and publish to S3
yarn release
```

This will:
- Bump the patch version
- Build installers for your platform
- Publish to S3
- Update metadata files

### Platform-Specific Builds

```bash
# macOS only
yarn electron-builder --mac --publish always

# Linux only
yarn electron-builder --linux --publish always

# Windows only (from Windows machine)
yarn electron-builder --win --publish always
```

### Build Without Publishing

To test builds without publishing:

```bash
# Build installers locally (no S3 upload)
yarn make

# Installers will be in ./dist/
```

## Post-Release Tasks

After a successful release:

### 1. Verify the Build

- **Check S3 Bucket**: Confirm files exist in `peers-electron-app/releases/`
- **Check Metadata**: Verify `latest-mac.yml`, `latest.yml`, `latest-linux.yml` are updated
- **Check Website**: Visit download page and verify links work

### 2. Test Installation

Download and test installers:

```bash
# macOS
# Download from S3 or GitHub Actions artifacts
# Double-click DMG and install

# Linux
sudo dpkg -i Peers_0.6.8_amd64.deb
# Or use AppImage
chmod +x Peers-0.6.8.AppImage
./Peers-0.6.8.AppImage

# Windows
# Download and run Peers Setup 0.6.8.exe
```

### 3. Update Download Links

The CI/CD pipeline automatically updates download links in peers-services.

To verify:

```bash
cd ../peers-services
yarn update-app-urls
```

### 4. Announce the Release

Consider:
- Creating a GitHub Release with release notes
- Announcing on social media / Discord / Slack
- Updating documentation if needed

### 5. Monitor for Issues

After release:
- Monitor error logs
- Check user reports
- Verify auto-update works for existing users

## Troubleshooting

### Build Fails in CI/CD

**Check**:
1. Review GitHub Actions logs
2. Verify all secrets are configured correctly
3. Check if dependencies are up to date
4. Look for platform-specific errors

**Common Issues**:

#### "AWS credentials not configured"
- Add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets

#### "Apple notarization failed"
- Verify `APPLE_ID` is correct
- Check `APPLE_APP_SPECIFIC_PASSWORD` is an app-specific password (not regular password)
- Ensure `APPLE_TEAM_ID` matches your Developer account

#### "Permission denied" on S3 upload
- Check IAM user has correct S3 permissions
- Verify bucket name and region are correct

### Local Build Fails

**Check**:
1. `.env` file exists and has correct values
2. `dotenv` package is installed
3. AWS credentials are valid
4. Node.js version is 20+

**Common Issues**:

#### "Module not found: dotenv"
```bash
yarn add dotenv
```

#### "AWS credentials not found"
- Check `.env` file exists
- Verify credentials are not empty strings

#### "electron-builder failed"
- Check electron-builder logs
- Verify native modules are compiled correctly
- Try rebuilding: `yarn rebuild`

### Download Links Not Updating

**Check**:
1. `peers-services` repository is accessible
2. `PEERS_SERVICES_PAT` is valid and has `repo` scope
3. Script can fetch YAML files from S3

**Solution**:
```bash
# Manually update links
cd ../peers-services
yarn update-app-urls
git add public/download.html
git commit -m "chore: Update download links"
git push
```

### Auto-update Not Working

**Check**:
1. Metadata files exist in S3 (latest-mac.yml, latest.yml, latest-linux.yml)
2. Version in metadata matches installer version
3. App has permissions to check for updates

**Solution**:
- Verify electron-updater configuration
- Check app logs for update errors
- Test manually: Help → Check for Updates

## Security Best Practices

### Credential Management

- ✅ **DO**: Use GitHub Secrets for CI/CD
- ✅ **DO**: Use `.env` file for local builds (gitignored)
- ✅ **DO**: Rotate credentials regularly (every 90 days)
- ❌ **DON'T**: Commit credentials to git
- ❌ **DON'T**: Share credentials in Slack/Discord
- ❌ **DON'T**: Use production credentials for testing

### IAM Permissions

- Use minimal permissions (least privilege principle)
- Create separate IAM user for CI/CD
- Only grant S3 access (see [ci-cd-pipeline.md](ci-cd-pipeline.md#iam-policy-for-cicd))
- Enable MFA on AWS account

### Token Rotation

Personal Access Tokens expire. Set a reminder to rotate:

1. Generate new token before expiration
2. Update `PEERS_SERVICES_PAT` secret
3. Verify workflow still works
4. Delete old token

## Related Documentation

- [CI/CD Pipeline Details](ci-cd-pipeline.md)
- [Download Links Management](../../peers-services/docs/download-links.md)
- [GitHub Actions Workflows](.github/README.md)
- [electron-builder Documentation](https://www.electron.build/)

## Support

For deployment issues:

1. Check this documentation
2. Review GitHub Actions logs
3. Check electron-builder documentation
4. Open an issue in the repository

## Change Log

- **2024-10-22**: Initial deployment guide
  - Documented CI/CD pipeline usage
  - Added first-time setup instructions
  - Included troubleshooting section
  - Added security best practices
