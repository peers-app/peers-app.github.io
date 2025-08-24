import fse from 'fs-extra';
import path from 'node:path';

const TEST_SOURCES_ROOT = '_sources';

async function setupTestSources() {
  console.log('Setting up test source directories...');
  
  // Create minimal test repo structures
  const testRepos = [
    {
      name: 'peers-sdk',
      structure: {
        'docs/index.md': '# Peers SDK\n\nCore SDK documentation.',
        'docs/devices.md': '# Device Management\n\nHow to manage devices.',
        'docs/data/orm.md': '# ORM\n\nData layer documentation.',
        'README.md': '# Peers SDK\n\nThe core SDK for peers application.'
      }
    },
    {
      name: 'peers-ui',
      structure: {
        'README.md': '# Peers UI\n\nReact UI components for peers application.',
        'COMPONENT_GUIDE.md': '# Component Guide\n\nHow to use UI components.'
      }
    },
    {
      name: 'peers-host',
      structure: {
        'README.md': '# Peers Host\n\nHost service for peer management.',
        'claude.md': '# Claude Integration\n\nNotes about Claude usage.',
        'peer-device-download-chunk.md': '# Device Download\n\nChunk download documentation.'
      }
    },
    {
      name: 'peers-electron',
      structure: {
        'README.md': '# Peers Electron\n\nElectron desktop application.',
        'CLAUDE.md': '# Development Notes\n\nDevelopment and architecture notes.',
        'diagram.md': '# Architecture Diagram\n\nSystem architecture overview.',
        'packages.md': '# Package Dependencies\n\nKey packages and their usage.'
      }
    },
    {
      name: 'peers-react-native',
      structure: {
        'README.md': '# Peers React Native\n\nReact Native mobile application.'
      }
    }
  ];

  // Clean and create test sources
  await fse.emptyDir(TEST_SOURCES_ROOT);

  for (const repo of testRepos) {
    const repoPath = path.join(TEST_SOURCES_ROOT, repo.name);
    await fse.ensureDir(repoPath);
    
    for (const [filePath, content] of Object.entries(repo.structure)) {
      const fullPath = path.join(repoPath, filePath);
      await fse.ensureDir(path.dirname(fullPath));
      await fse.writeFile(fullPath, content);
    }
    
    console.log(`✓ Created test repo: ${repo.name}`);
  }

  console.log('Test sources setup complete!');
}

setupTestSources().catch(err => {
  console.error('Failed to setup test sources:', err);
  process.exit(1);
});