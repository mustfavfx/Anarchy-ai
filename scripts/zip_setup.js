import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const inputExePath = 'e:/New folder (5)/Anarchy Ai 0.07/setup_dist/Anarchy_AI_Setup.exe';
const outputZipPath = 'C:/Users/NITRO/Music/New folder/Anarchy_AI_Setup.zip';

async function main() {
  const zip = new JSZip();
  console.log(`Reading installer file: ${inputExePath}`);
  const content = fs.readFileSync(inputExePath);
  
  console.log('Adding installer to ZIP archive...');
  zip.file('Anarchy_AI_Setup.exe', content);

  console.log('Generating ZIP content...');
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  console.log(`Writing ZIP file to: ${outputZipPath}`);
  const outputDir = path.dirname(outputZipPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log('ZIP installer archive generated successfully!');
}

main().catch(err => {
  console.error('Error creating ZIP installer archive:', err);
});
