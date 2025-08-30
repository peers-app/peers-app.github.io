import fse = require('fs-extra');
import path = require('path');
import { execSync } from 'child_process';

type RepoSpec = {
  repo: string;           // "peers-app/peers-sdk"
  localSource: string;    // "../peers-sdk" (relative to this repo)
  docsDir?: string;       // default "docs", but can be "." for root-level docs
  branch?: string;        // default "main"
};

const REPOS: RepoSpec[] = [
  { repo: 'peers-app/peers-sdk',        localSource: '../peers-sdk',        docsDir: 'docs', branch: 'main' },
  { repo: 'peers-app/peers-ui',         localSource: '../peers-ui',         docsDir: '.', branch: 'main' },
  { repo: 'peers-app/peers-device',     localSource: '../peers-device',     docsDir: '.', branch: 'main' },
  { repo: 'peers-app/peers-electron',   localSource: '../peers-electron',   docsDir: '.', branch: 'main' },
  { repo: 'peers-app/peers-react-native', localSource: '../peers-react-native', docsDir: '.', branch: 'main' }
];

const SOURCES_ROOT = '_sources';

async function syncLocalRepos() {
  console.log('Syncing documentation from local peer repositories...');
  
  // Clean and create sources directory
  await fse.emptyDir(SOURCES_ROOT);

  for (const r of REPOS) {
    const sourceRepoPath = path.resolve(r.localSource);
    const destPath = path.join(SOURCES_ROOT, r.repo.split('/')[1]);
    
    if (!await fse.pathExists(sourceRepoPath)) {
      console.warn(`⚠️  [skip] Local repo not found: ${sourceRepoPath}`);
      console.warn(`   Make sure ${r.repo.split('/')[1]} is cloned at ${r.localSource}`);
      continue;
    }

    // Check if it's a git repo and get current status
    try {
      const gitStatus = execSync('git status --porcelain', { 
        cwd: sourceRepoPath, 
        encoding: 'utf-8' 
      }).trim();
      
      const currentBranch = execSync('git branch --show-current', { 
        cwd: sourceRepoPath, 
        encoding: 'utf-8' 
      }).trim();

      console.log(`📁 ${r.repo.split('/')[1]}: ${currentBranch}${gitStatus ? ' (uncommitted changes)' : ''}`);
      
      if (gitStatus) {
        console.log(`   Warning: Repository has uncommitted changes`);
      }
    } catch (error) {
      console.log(`📁 ${r.repo.split('/')[1]}: (not a git repo)`);
    }

    // Copy the entire repo to sources
    await fse.copy(sourceRepoPath, destPath, {
      filter: (src, dest) => {
        const relativePath = path.relative(sourceRepoPath, src);
        // Skip node_modules, .git, build directories, etc.
        if (relativePath.includes('node_modules')) return false;
        if (relativePath.includes('.git')) return false;
        if (relativePath.includes('build')) return false;
        if (relativePath.includes('dist')) return false;
        if (relativePath.includes('coverage')) return false;
        if (relativePath.includes('.next')) return false;
        if (relativePath.includes('ios/Pods')) return false;
        if (relativePath.includes('android/.gradle')) return false;
        return true;
      }
    });
    
    console.log(`✅ Copied ${r.repo.split('/')[1]}`);
  }

  console.log(`\n🎉 Sync complete! Run 'npm run aggregate' to process documentation.`);
}

syncLocalRepos().catch(err => {
  console.error('Failed to sync local repos:', err);
  process.exit(1);
});