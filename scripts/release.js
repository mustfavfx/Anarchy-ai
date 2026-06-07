#!/usr/bin/env node
/**
 * Release Helper Script
 * Usage: node scripts/release.js [patch|minor|major|version]
 * Example: node scripts/release.js patch
 * Example: node scripts/release.js 0.7.1
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read current version from package.json
const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

function bumpVersion(version, type) {
  const [major, minor, patch] = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

function validateVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function updateVersion(newVersion) {
  // Update package.json
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✅ Updated package.json to v${newVersion}`);

  // Update tauri.conf.json
  const tauriConfPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
  const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`✅ Updated tauri.conf.json to v${newVersion}`);

  // Update Cargo.toml
  const cargoTomlPath = join(rootDir, 'src-tauri', 'Cargo.toml');
  let cargoToml = readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(
    /^version = "[\d.]+"$/m,
    `version = "${newVersion}"`
  );
  writeFileSync(cargoTomlPath, cargoToml);
  console.log(`✅ Updated Cargo.toml to v${newVersion}`);
}

function createGitTag(version) {
  try {
    // Stage changes
    execSync('git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml', { cwd: rootDir });
    
    // Commit
    execSync(`git commit -m "Release v${version}"`, { cwd: rootDir });
    console.log(`✅ Committed version changes`);
    
    // Create tag
    execSync(`git tag v${version}`, { cwd: rootDir });
    console.log(`✅ Created git tag v${version}`);
    
    // Push to origin
    console.log('\n📤 To push the release, run:');
    console.log(`   git push origin main`);
    console.log(`   git push origin v${version}`);
    console.log('\n🚀 GitHub Actions will automatically build and publish the release!');
  } catch (error) {
    console.error('❌ Git operation failed:', error.message);
    process.exit(1);
  }
}

// Main
const arg = process.argv[2];

if (!arg) {
  console.log(`Current version: v${currentVersion}`);
  console.log('\nUsage:');
  console.log('  node scripts/release.js patch   # Bump patch version (0.7.0 -> 0.7.1)');
  console.log('  node scripts/release.js minor   # Bump minor version (0.7.0 -> 0.8.0)');
  console.log('  node scripts/release.js major   # Bump major version (0.7.0 -> 1.0.0)');
  console.log('  node scripts/release.js 0.7.1   # Set specific version');
  process.exit(0);
}

let newVersion;

if (['patch', 'minor', 'major'].includes(arg)) {
  newVersion = bumpVersion(currentVersion, arg);
} else if (validateVersion(arg)) {
  newVersion = arg;
} else {
  console.error('❌ Invalid version or type. Use: patch, minor, major, or x.x.x');
  process.exit(1);
}

console.log(`🚀 Releasing: v${currentVersion} → v${newVersion}\n`);

updateVersion(newVersion);
createGitTag(newVersion);

console.log(`\n✨ Release v${newVersion} prepared successfully!`);
