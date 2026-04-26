# CI/CD Pipeline Documentation

## Overview

This document describes the automated CI/CD pipeline for building and releasing the Peers Electron application across all platforms (macOS, Linux, and Windows).

## Architecture

### Workflow File

`.github/workflows/build-and-release.yml`

### Key Components

1. **Build Job**: Builds installers for all platforms in parallel
2. **Update Links Job**: Automatically updates download links in peers-services
3. **Notify Job**: Reports the final status of the pipeline

### Supported Platforms

- **macOS**: ARM64 and x64 DMG files
- **Linux**: DEB packages and AppImage files
- **Windows**: NSIS installer EXE files

## Triggers

The workflow can be triggered in two ways:

### 1. Git Tags (Automatic)

```bash
# Create and push a version tag
git tag v0.6.8
git push origin v0.6.8
```

### 2. Manual Dispatch (GitHub UI)

1. Go to Actions tab in GitHub
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Optionally specify a version number

## GitHub Secrets Configuration

Before the workflow can run, you must configure the following secrets in your GitHub repository settings:

### Required Secrets

1. **AWS Credentials** (for S3 publishing)
   - `AWS_ACCESS_KEY_ID`: Your AWS access key ID
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key

2. **Apple Credentials** (for macOS signing and notarization)
   - `APPLE_ID`: Your Apple ID email (e.g., mark_archer@live.com)
   - `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password from Apple
   - `APPLE_TEAM_ID`: Your Apple Developer Team ID (e.g., 6443V55B66)

3. **Cross-Repository Access** (for updating peers-services)
   - `PEERS_SERVICES_PAT`: Personal Access Token with `repo` scope for peers-services

### Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the appropriate name and value

### Creating a Personal Access Token (PAT)

For `PEERS_SERVICES_PAT`:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: "peers-electron CI/CD"
4. Select scopes: `repo` (Full control of private repositories)
5. Generate token and save it securely
6. Add it as `PEERS_SERVICES_PAT` secret in peers-electron repository

## Workflow Steps

### Job 1: Build (Runs on all platforms)

1. **Checkout code**: Clones the repository
2. **Setup Node.js**: Installs Node.js 20 with yarn caching
3. **Install dependencies**: Runs `yarn install`
4. **Build application**: Runs `yarn build` (TypeScript + Webpack)
5. **Configure AWS**: Sets up AWS credentials for S3 publishing
6. **Platform-specific prep**: Configures signing for macOS/Windows
7. **Build and publish**: Runs `electron-builder` with `--publish always`
8. **Upload artifacts**: Saves installers for download (7-day retention)

### Job 2: Update Download Links (Runs after all builds succeed)

1. **Checkout peers-services**: Clones the peers-services repository
2. **Setup Node.js**: Installs Node.js 20
3. **Install dependencies**: Runs `yarn install` in peers-services
4. **Update URLs**: Runs `yarn update-app-urls` to fetch latest versions from S3
5. **Commit and push**: Commits updated download.html and pushes to main branch

### Job 3: Notify (Runs after all jobs complete)

1. **Check status**: Verifies both build and update jobs succeeded
2. **Report**: Outputs success or failure message

## Build Matrix

The workflow uses a GitHub Actions matrix strategy to build all platforms in parallel:

```yaml
matrix:
  include:
    - os: macos-latest
      platform: mac
    - os: ubuntu-latest
      platform: linux
    - os: windows-latest
      platform: windows
```

This ensures:
- Faster builds (parallel execution)
- Platform-specific configurations
- Isolated build environments

## S3 Publishing

Each platform build automatically publishes to the S3 bucket:

- **Bucket**: `peers-electron-app`
- **Region**: `us-west-1`
- **Path**: `releases/`
- **ACL**: `public-read`

Files published:
- Installers (DMG, EXE, DEB, AppImage)
- Update metadata (latest-mac.yml, latest.yml, latest-linux.yml)
- Blockmap files for delta updates

## Version Management

### Automatic Versioning

The workflow reads the version from `package.json`:

```json
{
  "version": "0.6.7"
}
```

### Updating the Version

Before triggering a release, update the version:

```bash
# Option 1: Use npm version command
npm version patch  # 0.6.7 → 0.6.8
npm version minor  # 0.6.7 → 0.7.0
npm version major  # 0.6.7 → 1.0.0

# Option 2: Edit package.json manually
# Then commit the change
git add package.json
git commit -m "chore: Bump version to 0.6.8"
git push

# Create and push the tag
git tag v0.6.8
git push origin v0.6.8
```

## Code Signing

### macOS

- **Signing**: Automatic via Apple Developer certificate
- **Notarization**: Automatic via Apple notarization service
- **Requirements**:
  - Valid Apple Developer account
  - App-specific password
  - Team ID

The workflow sets these environment variables:
```bash
APPLE_ID=<your-apple-id>
APPLE_APP_SPECIFIC_PASSWORD=<app-specific-password>
APPLE_TEAM_ID=<team-id>
```

### Windows

Currently, Windows builds are unsigned. To enable signing:

1. Obtain a code signing certificate
2. Add certificate to GitHub Secrets
3. Update the workflow to configure Windows signing

### Linux

Linux builds do not require code signing.

## Monitoring and Debugging

### Viewing Workflow Runs

1. Go to the Actions tab in GitHub
2. Select a workflow run to see details
3. Click on individual jobs to see logs

### Common Issues

#### Build Fails on macOS

**Problem**: Notarization fails

**Solutions**:
- Verify APPLE_ID is correct
- Check that APPLE_APP_SPECIFIC_PASSWORD is valid (not your regular password)
- Ensure APPLE_TEAM_ID matches your Developer account

#### Build Fails on Windows

**Problem**: Dependencies fail to install

**Solutions**:
- Check that all native modules are compatible with Windows
- Verify electron-rebuild runs successfully
- Review node-gyp logs

#### S3 Upload Fails

**Problem**: AccessDenied error

**Solutions**:
- Verify AWS credentials are correct
- Check IAM permissions for S3 bucket
- Ensure bucket exists and is in correct region

#### Update Links Job Fails

**Problem**: Cannot push to peers-services

**Solutions**:
- Verify PEERS_SERVICES_PAT is valid and has `repo` scope
- Check that the PAT hasn't expired
- Ensure the repository name is correct

### Artifact Downloads

After a successful build, you can download installers from the GitHub Actions page:

1. Go to the workflow run
2. Scroll to "Artifacts" section
3. Download platform-specific installers
4. Artifacts are kept for 7 days

## Security Considerations

### Secrets Management

**IMPORTANT**: Never commit secrets to the repository!

The workflow previously had hardcoded credentials in `electron-builder.js`:

```javascript
// ❌ BAD: Hardcoded credentials (removed from workflow)
setEnvValue('AWS_ACCESS_KEY_ID', 'AKIA...<REDACTED>');
setEnvValue('AWS_SECRET_ACCESS_KEY', '<REDACTED>');
```

The CI/CD workflow uses GitHub Secrets instead:

```yaml
# ✅ GOOD: Use GitHub Secrets
env:
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Recommended Actions

1. **Rotate exposed credentials**: If credentials were committed to git history, rotate them immediately
2. **Use IAM roles with minimal permissions**: Create a dedicated IAM user for CI/CD with only S3 publish permissions
3. **Enable S3 versioning**: Allows rollback if bad release is published
4. **Enable S3 access logging**: Track all access to the bucket
5. **Review commit history**: Check if sensitive data was committed

### IAM Policy for CI/CD

Recommended minimal IAM policy for the AWS user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::peers-electron-app",
        "arn:aws:s3:::peers-electron-app/*"
      ]
    }
  ]
}
```

## Local Development vs CI/CD

### Local Builds

For local testing, continue using:

```bash
# Build without publishing
yarn make

# Build and publish to S3 (requires local credentials)
yarn release
```

### CI/CD Builds

For production releases, always use the CI/CD pipeline:

```bash
# Update version
npm version patch

# Commit and tag
git add package.json
git commit -m "chore: Bump version to 0.6.8"
git tag v0.6.8

# Push to trigger CI/CD
git push origin main
git push origin v0.6.8
```

## Workflow Customization

### Changing Build Targets

To modify which files are built for each platform, edit `electron-builder.js`:

```javascript
// Example: Add Windows x64 and ia32 targets
win: {
  icon: "images/peers-512x512.png",
  target: [
    {
      target: "nsis",
      arch: ["x64", "ia32"]
    }
  ]
}
```

### Adding Build Notifications

To send Slack/Discord notifications on build completion:

```yaml
- name: Send notification
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Conditional Publishing

To only publish on specific branches:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'
    branches:
      - main
      - release/*
```

## Testing the Pipeline

### Test Run Checklist

Before pushing a real release:

1. **Test manual dispatch**: Verify the workflow can be triggered manually
2. **Test artifact upload**: Check that installers are uploaded correctly
3. **Test S3 publishing**: Verify files appear in S3 bucket
4. **Test download links update**: Check that peers-services is updated
5. **Test on all platforms**: Download and install each platform's build

### Dry Run

To test without publishing:

1. Change `--publish always` to `--publish never` in workflow
2. Push changes to a test branch
3. Trigger workflow manually
4. Review artifacts
5. Revert changes before real release

## Future Improvements

### 1. Automated Testing

Add test job before build:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: yarn install
      - run: yarn test

  build:
    needs: test
    # ... rest of build job
```

### 2. Release Notes Generation

Automatically generate release notes from commits:

```yaml
- name: Generate release notes
  uses: release-drafter/release-drafter@v5
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 3. Automatic Version Bumping

Use semantic-release to automate version bumping:

```yaml
- name: Semantic Release
  uses: cycjimmy/semantic-release-action@v3
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 4. Pre-release Channels

Support beta/alpha releases:

```yaml
on:
  push:
    tags:
      - 'v*.*.*'           # Stable release
      - 'v*.*.*-beta.*'    # Beta release
      - 'v*.*.*-alpha.*'   # Alpha release
```

### 5. Code Signing for Windows

Add Windows code signing:

```yaml
- name: Sign Windows executable
  if: matrix.platform == 'windows'
  uses: signpath/github-action-submit-signing-request@v0.3
  with:
    api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id: ${{ secrets.SIGNPATH_ORGANIZATION_ID }}
    project-slug: 'peers-electron'
    artifact-configuration-slug: 'release-signing'
```

### 6. Multi-Region S3 Deployment

Deploy to multiple S3 regions or use CloudFront:

```yaml
- name: Sync to CloudFront
  run: |
    aws s3 sync dist/ s3://peers-electron-app/releases/ \
      --acl public-read \
      --cache-control max-age=31536000
    aws cloudfront create-invalidation \
      --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
      --paths "/*"
```

## Troubleshooting

### Workflow won't trigger

**Check**:
- Tag format matches `v*.*.*` pattern
- Tag was pushed to remote: `git push origin v0.6.8`
- Workflow file is on the default branch

### Build succeeds but files not in S3

**Check**:
- AWS credentials are correct
- `--publish always` flag is set
- electron-builder.js has correct S3 configuration
- S3 bucket name and region are correct

### Download links not updating

**Check**:
- PEERS_SERVICES_PAT has correct permissions
- Repository name is correct in workflow
- update-app-urls script runs without errors
- Script can fetch YAML files from S3

### Builds are slow

**Solutions**:
- Enable yarn caching (already configured)
- Use smaller runner instances
- Cache node_modules between runs
- Reduce number of dependencies

## Related Files

- `.github/workflows/build-and-release.yml` - Main workflow file
- `electron-builder.js` - electron-builder configuration
- `package.json` - Version and scripts configuration
- `../peers-services/scripts/update-app-urls.js` - Download links updater
- `../peers-services/docs/download-links.md` - Download links documentation

## Support

For issues with the CI/CD pipeline:

1. Check workflow logs in GitHub Actions
2. Review this documentation
3. Check electron-builder documentation
4. Open an issue in the repository

## Change Log

- **2024-10-22**: Initial CI/CD pipeline implementation
  - Created GitHub Actions workflow for all platforms
  - Integrated electron-builder action
  - Added automatic download links update
  - Configured AWS S3 publishing
  - Set up artifact uploads
  - Added comprehensive documentation
