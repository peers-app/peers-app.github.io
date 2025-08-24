import fse from 'fs-extra';
import { globby } from 'globby';
import matter from 'gray-matter';
import path from 'node:path';

type RepoSpec = {
  repo: string;           // "peers-app/peers-sdk"
  local: string;          // where actions/checkout placed it: "_sources/peers-sdk"
  docsDir?: string;       // default "docs", but can be "." for root-level docs
  branch?: string;        // default "main"
};

const REPOS: RepoSpec[] = [
  { repo: 'peers-app/peers-sdk',        local: '_sources/peers-sdk',        docsDir: 'docs', branch: 'main' },
  { repo: 'peers-app/peers-ui',         local: '_sources/peers-ui',         docsDir: '.', branch: 'main' },      // only README
  { repo: 'peers-app/peers-host',       local: '_sources/peers-host',       docsDir: '.', branch: 'main' },      // README + some .md files
  { repo: 'peers-app/peers-electron',   local: '_sources/peers-electron',   docsDir: '.', branch: 'main' },      // README + some .md files
  { repo: 'peers-app/peers-react-native', local: '_sources/peers-react-native', docsDir: '.', branch: 'main' }   // only README
];

const OUT_ROOT = 'projects';

async function run() {
  await fse.emptyDir(OUT_ROOT);

  for (const r of REPOS) {
    const srcDocs = path.join(r.local, r.docsDir ?? 'docs');
    const out = path.join(OUT_ROOT, r.repo.split('/')[1]);

    if (!fse.existsSync(srcDocs)) {
      console.warn(`[skip] ${r.repo} has no ${srcDocs}`);
      continue;
    }

    // For root-level docs (docsDir === '.'), copy only markdown files and specific doc files
    if (r.docsDir === '.') {
      await fse.ensureDir(out);
      
      // Copy markdown files from root
      const markdownFiles = await globby(['*.md', '*.mdx'], { cwd: srcDocs });
      for (const file of markdownFiles) {
        await fse.copy(path.join(srcDocs, file), path.join(out, file));
      }
      
      // Also copy any dedicated doc files or directories that exist
      const docPatterns = ['docs/**/*', 'documentation/**/*', '*.md', 'CLAUDE.md'];
      const docFiles = await globby(docPatterns, { cwd: srcDocs });
      for (const file of docFiles) {
        const srcFile = path.join(srcDocs, file);
        const destFile = path.join(out, file);
        if (fse.existsSync(srcFile)) {
          await fse.ensureDir(path.dirname(destFile));
          await fse.copy(srcFile, destFile);
        }
      }
    } else {
      // For dedicated docs directories, copy everything
      await fse.copy(srcDocs, out);
    }

    // inject custom_edit_url into every .md/.mdx
    const files = await globby(['**/*.md', '**/*.mdx'], { cwd: out });
    for (const rel of files) {
      const abs = path.join(out, rel);
      const raw = await fse.readFile(abs, 'utf-8');
      const fm = matter(raw);

      // Calculate correct edit URL based on source location
      const sourceRelPath = r.docsDir === '.' ? rel : path.posix.join(r.docsDir ?? 'docs', rel);
      const custom = `https://github.com/${r.repo}/edit/${r.branch ?? 'main'}/${sourceRelPath.replace(/\\/g, '/')}`;

      const data = {
        // preserve existing front-matter
        ...fm.data,
        custom_edit_url: fm.data?.custom_edit_url ?? custom
      };

      await fse.writeFile(abs, matter.stringify(fm.content.trimStart() + '\n', data));
    }

    // add an index if missing
    const indexCandidates = ['index.md', 'README.md'];
    const hasIndex = indexCandidates.some(n => fse.existsSync(path.join(out, n)));
    if (!hasIndex) {
      await fse.writeFile(
        path.join(out, 'index.md'),
        matter.stringify(
          `# ${r.repo.split('/')[1]}\n\nProject documentation aggregated from \`${r.repo}\`.\n`,
          { custom_edit_url: `https://github.com/${r.repo}` }
        )
      );
    }
  }

  console.log('Aggregation complete.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});