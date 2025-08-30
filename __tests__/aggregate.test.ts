import fse from 'fs-extra';
import path from 'node:path';
import { execSync } from 'child_process';
import matter from 'gray-matter';

describe('Documentation Aggregation', () => {
  const testOutputDir = 'test-projects';
  const testSourcesDir = '_sources';

  beforeAll(async () => {
    // Setup test sources
    await execSync('npm run test:setup-sources', { stdio: 'inherit' });
  });

  beforeEach(async () => {
    // Clean test output
    await fse.remove(testOutputDir);
  });

  afterAll(async () => {
    await fse.remove(testOutputDir);
    await fse.remove(testSourcesDir);
  });

  it('should create projects directory and aggregate all repos', async () => {
    // Run aggregation script with test output
    process.env.OUT_ROOT = testOutputDir;
    
    // Import and run the aggregation function
    const aggregateModule = await import('../scripts/aggregate');
    
    // Verify projects directory exists
    expect(await fse.pathExists(testOutputDir)).toBe(true);

    // Check that all expected repos are aggregated
    const expectedRepos = ['peers-sdk', 'peers-ui', 'peers-device', 'peers-electron', 'peers-react-native'];
    
    for (const repo of expectedRepos) {
      const repoPath = path.join(testOutputDir, repo);
      expect(await fse.pathExists(repoPath)).toBe(true);
      
      // Check that each repo has at least a README or index
      const hasReadme = await fse.pathExists(path.join(repoPath, 'README.md'));
      const hasIndex = await fse.pathExists(path.join(repoPath, 'index.md'));
      expect(hasReadme || hasIndex).toBe(true);
    }
  });

  it('should inject custom_edit_url front-matter into markdown files', async () => {
    process.env.OUT_ROOT = testOutputDir;
    
    // Run aggregation
    const aggregateModule = await import('../scripts/aggregate');
    
    // Check a specific file for front-matter
    const sdkReadmePath = path.join(testOutputDir, 'peers-sdk', 'README.md');
    expect(await fse.pathExists(sdkReadmePath)).toBe(true);
    
    const content = await fse.readFile(sdkReadmePath, 'utf-8');
    const parsed = matter(content);
    
    expect(parsed.data.custom_edit_url).toBeDefined();
    expect(parsed.data.custom_edit_url).toContain('github.com/peers-app/peers-sdk');
    expect(parsed.data.custom_edit_url).toContain('/edit/main/');
  });

  it('should handle repos with dedicated docs directories differently from root docs', async () => {
    process.env.OUT_ROOT = testOutputDir;
    
    // Run aggregation
    const aggregateModule = await import('../scripts/aggregate');
    
    // Check peers-sdk (has docs directory)
    const sdkDocsPath = path.join(testOutputDir, 'peers-sdk', 'devices.md');
    expect(await fse.pathExists(sdkDocsPath)).toBe(true);
    
    // Verify edit URL points to docs/ subdirectory
    const docsContent = await fse.readFile(sdkDocsPath, 'utf-8');
    const docsParsed = matter(docsContent);
    expect(docsParsed.data.custom_edit_url).toContain('/docs/devices.md');
    
    // Check peers-ui (root-level docs only)
    const uiReadmePath = path.join(testOutputDir, 'peers-ui', 'README.md');
    expect(await fse.pathExists(uiReadmePath)).toBe(true);
    
    // Verify edit URL points to root
    const uiContent = await fse.readFile(uiReadmePath, 'utf-8');
    const uiParsed = matter(uiContent);
    expect(uiParsed.data.custom_edit_url).not.toContain('/docs/');
    expect(uiParsed.data.custom_edit_url).toContain('/README.md');
  });

  it('should create index.md for repos without one', async () => {
    // Create a test repo without README or index
    const testRepoPath = path.join(testSourcesDir, 'test-repo');
    await fse.ensureDir(testRepoPath);
    await fse.writeFile(path.join(testRepoPath, 'other.md'), '# Other Doc');
    
    process.env.OUT_ROOT = testOutputDir;
    
    // Temporarily modify REPOS array to include test repo
    const aggregateScript = await fse.readFile('scripts/aggregate.ts', 'utf-8');
    const modifiedScript = aggregateScript.replace(
      'const REPOS: RepoSpec[] = [',
      `const REPOS: RepoSpec[] = [
  { repo: 'peers-app/test-repo', local: '_sources/test-repo', docsDir: '.', branch: 'main' },`
    );
    await fse.writeFile('scripts/aggregate-test.ts', modifiedScript);
    
    // Import and run modified aggregation
    delete require.cache[path.resolve('scripts/aggregate-test.ts')];
    await import('../scripts/aggregate-test');
    
    // Check that index.md was created
    const indexPath = path.join(testOutputDir, 'test-repo', 'index.md');
    expect(await fse.pathExists(indexPath)).toBe(true);
    
    const indexContent = await fse.readFile(indexPath, 'utf-8');
    expect(indexContent).toContain('# test-repo');
    expect(indexContent).toContain('peers-app/test-repo');
    
    // Cleanup
    await fse.remove('scripts/aggregate-test.ts');
    await fse.remove(testRepoPath);
  });
});