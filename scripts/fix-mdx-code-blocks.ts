import fse = require('fs-extra');
import { globby } from 'globby';
import path = require('path');

async function fixMdxCodeBlocks() {
  console.log('Fixing MDX code block issues...');
  
  const files = await globby(['projects/**/*.md'], { dot: false });
  
  for (const file of files) {
    const content = await fse.readFile(file, 'utf-8');
    let modified = false;
    
    // Find code blocks that aren't properly wrapped and contain export/import
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeBlockType = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track code block state
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          codeBlockType = '';
        } else {
          inCodeBlock = true;
          codeBlockType = line.substring(3);
        }
        continue;
      }
      
      // If we're not in a code block and line contains export/import, we need to fix it
      if (!inCodeBlock && (line.trim().startsWith('export ') || line.trim().startsWith('import '))) {
        console.log(`⚠️  Found unescaped export/import in ${file}:${i + 1}`);
        console.log(`   Line: ${line.trim()}`);
        
        // Find the end of this code section
        let endIndex = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === '' || lines[j].startsWith('#') || lines[j].startsWith('⸻')) {
            endIndex = j - 1;
            break;
          }
          endIndex = j;
        }
        
        // Wrap in typescript code block
        lines.splice(i, 0, '```typescript');
        lines.splice(endIndex + 2, 0, '```');
        modified = true;
        i = endIndex + 2; // Skip past the code block we just created
      }
    }
    
    if (modified) {
      await fse.writeFile(file, lines.join('\n'));
      console.log(`✅ Fixed MDX issues in ${file}`);
    }
  }
  
  console.log('MDX code block fixing complete!');
}

fixMdxCodeBlocks().catch(err => {
  console.error('Failed to fix MDX code blocks:', err);
  process.exit(1);
});