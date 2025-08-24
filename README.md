# Peers App Documentation Hub

A Docusaurus-based documentation hub that aggregates documentation from all Peers repositories.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup test sources (for local development)
npm run test:setup-sources

# Aggregate documentation
npm run aggregate

# Start development server
npm start

# Build for production
npm run build
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

1. **GitHub Actions** automatically triggers on pushes to main
2. **Aggregation script** checks out all source repositories
3. **Documentation files** are copied and processed:
   - `peers-sdk`: Uses dedicated `/docs` folder
   - Other repos: Uses root-level markdown files
4. **Front-matter injection** adds `custom_edit_url` to each page
5. **Docusaurus build** generates static site
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

### Local Development with Real Sources

To test with actual repository data instead of mock data:

```bash
# Create _sources directory and clone repos manually
mkdir -p _sources
cd _sources
git clone https://github.com/peers-app/peers-sdk.git
git clone https://github.com/peers-app/peers-ui.git
# ... clone other repos

cd ..
npm run aggregate
npm start
```

## 🎯 Production Deployment

The site automatically deploys to GitHub Pages when code is pushed to the `main` branch. 

Manual deployment:
```bash
npm run build
npm run deploy
```

## 📝 Notes

- Edit URLs automatically point back to source repositories
- Documentation is rebuilt on every deployment
- Each repository maintains its documentation in its own repo
- Changes to source docs appear after next deployment