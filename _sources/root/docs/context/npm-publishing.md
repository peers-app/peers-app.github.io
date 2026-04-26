# npm Publishing Setup

## Authentication

npm tokens are stored in the user-level `~/.npmrc` file (not in the project). This allows `npm publish` to work from any subdirectory.

### Setting Up a Token

1. Go to **https://www.npmjs.com** → Sign in
2. Click your profile icon → **Access Tokens**
3. Click **"Generate New Token"** → **"Granular Access Token"**
4. Configure:
   - **Token name:** e.g., "peers-app-publish"
   - **Expiration:** up to 90 days (tokens must be rotated periodically)
   - **Packages and scopes:** Select `@peers-app`
   - **Permissions:** Read and write
5. Run:
   ```bash
   npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN_HERE
   ```

### Verifying Setup

```bash
npm whoami
# Should output your npm username
```

## Token Expiration

As of November 2025, npm granular tokens have a **maximum 90-day expiration**. You'll need to generate a new token and run `npm config set` again when it expires.

## Publishing Packages

The release script handles publishing all packages:

```bash
./full-release.js patch   # Bump patch version and publish
./full-release.js minor   # Bump minor version and publish
./full-release.js major   # Bump major version and publish
```

Published packages:
- `@peers-app/peers-sdk`
- `@peers-app/peers-device`
- `@peers-app/peers-ui`
