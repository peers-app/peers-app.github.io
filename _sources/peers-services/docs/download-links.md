# Download Links Management

## Overview

This document explains how the download links on the landing page are managed and automatically updated to reference the correct application installers in AWS S3.

## System Architecture

### Components

1. **Landing Page**: `/public/download.html`
   - Contains the public-facing download page
   - Displays download buttons for different platforms and architectures

2. **Update Script**: `/scripts/update-app-urls.js`
   - Node.js script that automatically updates download URLs
   - Fetches version info directly from S3 bucket metadata files
   - Parses `latest-mac.yml`, `latest.yml` (Windows), and `latest-linux.yml`
   - Generates correct S3 URLs for all available platforms
   - Updates the HTML file with new URLs

3. **Package Script**: `yarn update-app-urls`
   - Defined in `/package.json`
   - Executes the update script

### How It Works

The script fetches the auto-updater metadata files that electron-builder publishes to S3:
- `latest-mac.yml` - Contains macOS version and file information
- `latest.yml` - Contains Windows version and file information
- `latest-linux.yml` - Contains Linux version and file information

These YAML files are publicly accessible and always point to the latest version for each platform. The script parses these files to extract:
- Version number
- Available file formats (ARM64, x64, DEB, AppImage, etc.)
- Constructs the correct download URLs

### S3 Bucket Configuration

- **Bucket Name**: `peers-electron-app`
- **Region**: `us-west-1`
- **Path**: `releases/`
- **ACL**: `public-read`
- **Base URL**: `https://peers-electron-app.s3.us-west-1.amazonaws.com/releases/`

## File Naming Convention

The electron-builder publishes files to S3 using the following naming pattern:

### macOS
- **Apple Silicon (ARM64)**: `Peers-{version}-arm64.dmg`
  - Example: `Peers-0.6.7-arm64.dmg`
  - Current latest: v0.6.7
- **Intel (x64)**: `Peers-{version}-x64.dmg`
  - Example: `Peers-0.6.7-x64.dmg`
- **Universal Build**: `Peers-{version}.dmg` (if configured)
  - Example: `Peers-0.6.7.dmg`

### Windows
- **NSIS Installer**: `Peers Setup {version}.exe`
  - Example: `Peers Setup 0.3.2.exe`
  - Current latest: v0.3.2

### Linux
- **Debian Package**: `Peers_{version}_amd64.deb`
  - Example: `Peers_0.4.2_amd64.deb`
  - Current latest: v0.4.2
- **AppImage**: `Peers-{version}.AppImage`
  - Example: `Peers-0.4.2.AppImage`
  - Current latest: v0.4.2

### Additional Files in S3
- `.blockmap` files - Used for delta updates by electron-updater
- `.zip` files - Alternative macOS distribution format
- `latest-mac.yml` - Auto-updater metadata for macOS
- `latest.yml` - Auto-updater metadata for Windows
- `latest-linux.yml` - Auto-updater metadata for Linux

## Usage

### Updating Download Links

The script automatically fetches the latest versions from S3. Simply run:

```bash
cd peers-services
yarn update-app-urls
```

This will:
1. Fetch `latest-mac.yml`, `latest.yml`, and `latest-linux.yml` from S3
2. Parse the YAML files to extract version numbers and available formats
3. Generate the correct S3 URLs for all platforms
4. Update `/public/download.html` with the new URLs

### Recommended Workflow

The script fetches versions directly from S3, so you can run it anytime to sync with the latest releases:

1. Release new peers-electron version (publishes to S3):
   ```bash
   cd peers-electron
   yarn release
   ```

2. Update landing page download links (fetches from S3):
   ```bash
   cd ../peers-services
   yarn update-app-urls
   ```

3. Commit and deploy the updated HTML:
   ```bash
   git add public/download.html
   git commit -m "chore: Update download links to latest versions"
   git push
   ```

**Note**: The script is idempotent - running it multiple times with the same S3 state will produce the same result.

## Current Implementation

### Download Button with Platform Detection

The landing page uses a Bootstrap split button that:
1. **Auto-detects the user's platform** (macOS, Windows, Linux)
2. **Shows the appropriate download** as the primary button
3. **Provides a dropdown** with all available platform options

**Structure**:
```html
<div class="btn-group" role="group">
  <a id="primaryDownload" href="#" class="btn btn-primary btn-lg" download>
    <span id="downloadText">Download for Your Platform</span>
  </a>
  <button type="button" class="btn btn-primary btn-lg dropdown-toggle dropdown-toggle-split"
          data-bs-toggle="dropdown">
  </button>
  <ul class="dropdown-menu dropdown-menu-dark">
    <!-- All platform options -->
  </ul>
</div>
```

**JavaScript Platform Detection**:
- Detects macOS, Windows, or Linux from `navigator.platform`
- For macOS, attempts to detect Apple Silicon vs Intel (defaults to ARM)
- Updates the primary button text and URL on page load
- Provides fallback to macOS ARM if platform is unknown

**Dependencies**:
- Bootstrap 5.3.2 CSS and JS (loaded from CDN)
- No additional dependencies

**Note**: The `download` attribute may not work perfectly for cross-origin resources. The browser behavior depends on:
- S3 CORS configuration
- Browser security policies
- File content-type headers

## Future Improvements

### 1. Automated Workflow Integration

**Goal**: Automatically update download links when releasing peers-electron

**Implementation**: Update `peers-electron/package.json`:

```json
{
  "scripts": {
    "release": "yarn version:patch && yarn build && electron-builder --publish always && cd ../peers-services && yarn update-app-urls"
  }
}
```

**Benefits**:
- Eliminates manual step
- Reduces human error
- Ensures links are always up-to-date

### 2. Dynamic Version Detection

**Goal**: Fetch latest version dynamically from S3

**Implementation Options**:

**Option A**: Use `latest-mac.yml` metadata file
- Fetch and parse the YAML file client-side
- Extract version and construct download URLs
- Eliminates need to update HTML after each release

**Option B**: Server-side API endpoint
- Create `/api/latest-version` endpoint
- Returns latest version and download URLs
- Frontend fetches and displays dynamically

**Code Example**:
```javascript
// Client-side fetch
fetch('https://peers-electron-app.s3.us-west-1.amazonaws.com/releases/latest-mac.yml')
  .then(response => response.text())
  .then(yaml => {
    // Parse YAML and extract version
    // Update download links dynamically
  });
```

### 3. Cross-Origin Download Issues

**Problem**: Downloads from S3 may redirect the page instead of downloading

**Solutions**:

**Option A**: Configure S3 CORS
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://yourdomain.com"],
      "AllowedMethods": ["GET"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

**Option B**: Use `target="_blank"`
```html
<a href="..." class="download-button" target="_blank">Download</a>
```

**Option C**: Proxy through server
```javascript
// Server-side route
app.get('/download/:platform/:arch', (req, res) => {
  const { platform, arch } = req.params;
  const s3Url = generateS3Url(platform, arch);
  res.redirect(s3Url);
});
```

### 4. ~~Platform Detection~~ ✅ IMPLEMENTED

Platform detection is now implemented using a Bootstrap split button with JavaScript detection. The system:
- Automatically detects the user's platform
- Shows the appropriate download as the primary button
- Provides a dropdown for other platforms

### 5. Enhanced Architecture Detection for macOS

**Goal**: More accurately detect Apple Silicon vs Intel

**Current State**: Basic heuristic detection (defaults to ARM)

**Potential Improvements**:
```javascript
async function detectMacArchitecture() {
  // Check for WebGL renderer info (Apple Silicon has different GPU)
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

  if (renderer.includes('Apple M')) {
    return 'arm64';
  }
  return 'x64';
}
```

### 6. Download Verification

**Goal**: Verify file integrity after download

**Implementation**:
- Generate and publish SHA256 checksums for each file
- Display checksum on landing page
- Provide instructions for verification

### 7. Multi-Region S3

**Goal**: Serve downloads from geographically closer locations

**Implementation**:
- Use CloudFront CDN in front of S3
- Reduces download time for international users
- Improves reliability

### 8. Analytics

**Goal**: Track which platforms/architectures are most popular

**Implementation Options**:
- Add Google Analytics events to download buttons
- Server-side logging via proxy endpoint
- S3 access logs analysis

## Troubleshooting

### Links are outdated after release

**Solution**: Run `yarn update-app-urls` in peers-services

### Files not found (404) in S3

**Check**:
1. Verify electron-builder published successfully
2. Check S3 console for actual file names
3. Verify naming convention matches script expectations

### Downloads redirect instead of downloading

**Solutions**:
1. Add `download` attribute to links (already implemented)
2. Configure S3 CORS headers
3. Use `target="_blank"` as fallback
4. Implement server-side proxy

### Version mismatch

**Check**:
1. Verify peers-electron/package.json has correct version
2. Ensure update script ran successfully
3. Check browser cache (hard refresh with Cmd+Shift+R)

## Related Files

- `/public/download.html` - Landing page HTML
- `/public/download.css` - Landing page styles (currently unused)
- `/scripts/update-app-urls.js` - URL update script
- `../peers-electron/package.json` - Source of version info
- `../peers-electron/electron-builder.js` - Build and publish configuration

## Security Considerations

### Hardcoded Credentials (Critical Issue)

**Current State**: AWS credentials are hardcoded in `peers-electron/electron-builder.js`

**Risks**:
- Credentials exposed in source control
- Anyone with repo access can publish to S3
- No audit trail for releases

**Recommendations**:
1. Move credentials to environment variables
2. Use IAM roles with minimal permissions
3. Implement GitHub Actions for automated releases
4. Enable S3 versioning and logging
5. Rotate exposed credentials immediately

### S3 Bucket Security

**Current Configuration**:
- Files are `public-read`
- No bucket versioning
- No access logging

**Recommended Configuration**:
- Enable versioning (allows rollback)
- Enable access logging
- Set up lifecycle policies for old versions
- Consider signed URLs for premium features

## Maintenance

### Regular Tasks

1. **After each release**: Run `yarn update-app-urls`
2. **Monthly**: Review S3 storage costs and cleanup old versions
3. **Quarterly**: Review and update this documentation
4. **As needed**: Test download links from different browsers/platforms

### Monitoring

Consider implementing:
- Automated link checking (verify downloads exist)
- S3 bucket size monitoring
- Download success rate tracking
- User feedback mechanism

## Change Log

- **2024-10-22**: Added Bootstrap split button with platform detection
  - Integrated Bootstrap 5.3.2 for improved UI
  - Implemented smart split button that detects user's platform
  - Primary button shows platform-specific download automatically
  - Dropdown provides access to all platform options
  - Updated script to work with new HTML structure (both JavaScript object and dropdown menu)

- **2024-10-22**: Enhanced implementation to fetch directly from S3
  - Updated script to fetch version info from S3 metadata files (`latest-mac.yml`, `latest.yml`, `latest-linux.yml`)
  - Removed dependency on peers-electron package.json
  - Added support for Windows and Linux downloads
  - Script now automatically detects available platforms and architectures
  - Made script idempotent and S3-based

- **2024-10-22**: Initial implementation of automated download link updates
  - Created `/scripts/update-app-urls.js`
  - Added `yarn update-app-urls` command
  - Updated links to use correct S3 naming convention
  - Added `download` attribute to prevent page redirects
  - Separated Apple Silicon and Intel downloads
