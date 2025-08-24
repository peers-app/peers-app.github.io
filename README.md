# Peers App Documentation Hub

A Docusaurus-based documentation hub that aggregates documentation from all Peers repositories.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Sync docs from local peer repos and start dev server
npm run docs

# Or step by step:
npm run sync      # Copy docs from ../peers-* repositories  
npm run aggregate # Process and inject front-matter
npm start         # Start development server
```

## 📋 Prerequisites

Make sure you have the peer repositories cloned at the same level:
```
parent-directory/
├── peers-app.github.io/     # This repo
├── peers-sdk/               # Required
├── peers-ui/                # Required  
├── peers-host/              # Required
├── peers-electron/          # Required
└── peers-react-native/      # Required
```

## 📁 Project Structure

```
peers-app.github.io/
├── src/pages/           # Landing page
├── scripts/             # Aggregation scripts
│   ├── aggregate.ts     # Main aggregation logic
│   └── setup-test-sources.ts  # Test data setup
├── projects/            # Generated docs (do not edit manually)
├── __tests__/           # Jest tests
└── .github/workflows/   # GitHub Actions
```

## 🔧 How It Works

1. **Local sync** copies docs from peer repos in `../` directories
2. **Aggregation script** processes documentation files:
   - `peers-sdk`: Uses dedicated `/docs` folder
   - Other repos: Uses root-level markdown files
3. **Front-matter injection** adds `custom_edit_url` to each page
4. **Manual commit** pushes processed docs to this repo
5. **GitHub Actions** automatically builds and deploys on push
6. **GitHub Pages** serves the final site

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Setup test environment and run aggregation
npm run setup-test
```

### Test Coverage

- ✅ Aggregation script functionality
- ✅ Front-matter injection with correct edit URLs
- ✅ Handling of different repository structures
- ✅ Docusaurus configuration validation
- ✅ Complete build process

## 📋 Repositories Included

- **peers-sdk**: Core SDK with data management and workflows
- **peers-ui**: React UI components and screens  
- **peers-host**: Host service for peer device management
- **peers-electron**: Electron desktop application
- **peers-react-native**: React Native mobile application

## 🛠 Development

### Adding New Repositories

1. Update `REPOS` array in `scripts/aggregate.ts`
2. Add checkout step in `.github/workflows/deploy.yml`
3. Update landing page in `src/pages/index.md`

### Workflow for Updating Docs

```bash
# Make changes in any peer repo (e.g., peers-sdk/docs/...)

# Sync and test locally
npm run docs

# When ready, sync and build for commit
npm run build:docs

# Commit the updated projects/ directory
git add projects/
git commit -m "Update documentation from peer repos"
git push

# GitHub Actions will automatically deploy the updated site
```

## 🎯 Production Deployment  

The site automatically deploys when you push changes to the `projects/` directory. The GitHub Action only triggers on relevant file changes, so you don't need authentication tokens.

**Local build for production:**
```bash
npm run build:docs  # Sync, aggregate, and build
```

## 📝 Notes

- Edit URLs automatically point back to source repositories
- Documentation is rebuilt on every deployment
- Each repository maintains its documentation in its own repo
- Changes to source docs appear after next deployment