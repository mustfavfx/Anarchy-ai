#!/usr/bin/env node
/**
 * Anarchy AI - Automated Setup Script
 * Run this after copying the project to a new device
 * 
 * Usage: node setup.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkNodeVersion() {
  try {
    const version = process.version;
    const major = parseInt(version.split('.')[0].replace('v', ''));
    
    if (major < 18) {
      log('❌ Node.js 18+ required. Current: ' + version, 'red');
      log('   Please upgrade from: https://nodejs.org', 'yellow');
      process.exit(1);
    }
    
    log(`✅ Node.js ${version} detected`, 'green');
    return true;
  } catch {
    // If process.version doesn't exist, we're not running Node at all
    log('❌ Node.js not found!', 'red');
    return false;
  }
}

// If Node.js is not available at all, show instructions
if (typeof process === 'undefined' || !process.version) {
  console.log('\n❌ Node.js is not installed on this system.');
  console.log('\n📦 Please install Node.js 18+ from:');
  console.log('   https://nodejs.org');
  console.log('\nOr run install-node.bat for automatic installation.\n');
  process.exit(1);
}

function setupEnv() {
  const envPath = path.join(__dirname, '.env');
  const envExamplePath = path.join(__dirname, '.env.example');
  
  if (fs.existsSync(envPath)) {
    log('✅ .env file already exists', 'green');
    
    // Check if API token is set
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('your_replicate_api_token') || !envContent.includes('r8_')) {
      log('⚠️  Warning: API token not configured in .env', 'yellow');
      log('   Please edit .env and add your Replicate API token', 'cyan');
    } else {
      log('✅ API token configured', 'green');
    }
    return;
  }
  
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    log('✅ Created .env from .env.example', 'green');
    log('⚠️  Please edit .env and add your Replicate API token', 'yellow');
    log('   Get token from: https://replicate.com/account/api-tokens', 'cyan');
  } else {
    log('⚠️  .env.example not found, creating empty .env', 'yellow');
    fs.writeFileSync(envPath, 'VITE_REPLICATE_API_TOKEN=\n');
  }
}

function installDependencies() {
  log('\n📦 Installing dependencies...', 'blue');
  
  try {
    execSync('npm install', { 
      stdio: 'inherit',
      cwd: __dirname
    });
    log('✅ Dependencies installed successfully', 'green');
  } catch (error) {
    log('❌ Failed to install dependencies', 'red');
    log('   Try running: npm install', 'cyan');
    process.exit(1);
  }
}

function startApp() {
  log('\n🚀 Starting Anarchy AI...', 'blue');
  log('   The app will open at http://localhost:5173\n', 'cyan');
  
  try {
    execSync('npm run dev', {
      stdio: 'inherit',
      cwd: __dirname
    });
  } catch (error) {
    // This will always "fail" because the dev server runs indefinitely
    // But we handle it gracefully
  }
}

function showWelcome() {
  console.log(`
${colors.cyan}${colors.bright}
    ___    __                        ______    ________ 
   /   |  / /___ _____  ____ ___     /  _/ /   /  _/ __ \
  / /| | / / __  / __ \/ __  _ \    / // /    / // / / /
 / ___ |/ / /_/ / / / / / /  __/  _/ // /_____/ // /_/ / 
/_/  |_/_/\\__,_/_/ /_/_/ /\\___/  /___/_____/___/\\____/  
${colors.reset}
${colors.bright}        AI-Powered Architectural Visualization${colors.reset}
`);
}

// Main execution
(async () => {
  showWelcome();
  
  log('\n🔧 Anarchy AI Setup', 'bright');
  log('====================\n', 'cyan');
  
  // Step 1: Check Node.js
  checkNodeVersion();
  
  // Step 2: Setup .env
  setupEnv();
  
  // Step 3: Check if node_modules exists
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    log('✅ node_modules already exists', 'green');
  } else {
    installDependencies();
  }
  
  // Step 4: Start the app
  startApp();
})();
