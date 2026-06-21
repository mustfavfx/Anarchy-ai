import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const projectRoot = 'e:/New folder (5)/Anarchy Ai 0.07';
const outputZipPath = 'C:/Users/NITRO/Music/New folder/Anarchy_AI_Codebase.zip';

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'setup_dist',
  '.git',
  '.github',
  '.vscode',
  '.windsurf',
  'target',
  'gen',
  '.venv',
  'coverage'
]);

const IGNORED_FILES = new Set([
  'package-lock.json',
  'eslint-report.json',
  'anarchy_combined_codebase.txt',
  'Anarchy_AI_Codebase.zip'
]);

async function main() {
  const zip = new JSZip();

  function addFilesToZip(dir, zipFolder) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (IGNORED_DIRS.has(item)) continue;
        const newZipFolder = zipFolder.folder(item);
        addFilesToZip(fullPath, newZipFolder);
      } else {
        if (IGNORED_FILES.has(item)) continue;
        // Skip files that are excessively large binary installers if any
        if (item.endsWith('.exe') || item.endsWith('.sig')) continue;
        
        const content = fs.readFileSync(fullPath);
        zipFolder.file(item, content);
      }
    }
  }

  console.log('Adding files to ZIP archive...');
  addFilesToZip(projectRoot, zip);

  console.log('Generating ZIP content...');
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  console.log(`Writing ZIP file to: ${outputZipPath}`);
  const outputDir = path.dirname(outputZipPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputZipPath, content);
  console.log('ZIP archive generated successfully!');
}

main().catch(err => {
  console.error('Error creating ZIP archive:', err);
});
