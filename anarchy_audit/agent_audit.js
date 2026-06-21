import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load prompts config
const promptsPath = path.join(__dirname, 'prompts.json');
if (!fs.existsSync(promptsPath)) {
  console.error('Error: prompts.json not found in the anarchy_audit folder.');
  process.exit(1);
}
const promptsConfig = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));

// Helper to parse CLI arguments
const args = process.argv.slice(2);
let apiKey = process.env.GEMINI_API_KEY || '';
let phaseToRun = '';
let runAll = false;
let modelName = 'gemini-2.5-flash';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key' || args[i] === '-k') {
    apiKey = args[i + 1];
    i++;
  } else if (args[i] === '--all' || args[i] === '-a') {
    runAll = true;
  } else if (args[i] === '--model' || args[i] === '-m') {
    modelName = args[i + 1];
    i++;
  } else if (!args[i].startsWith('-')) {
    phaseToRun = args[i];
  }
}

// Load API Key from project .env if not set
if (!apiKey) {
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.*)/);
    if (match && match[1]) {
      apiKey = match[1].trim();
    }
  }
}

// Display Help if requested or missing credentials/arguments
if (args.includes('--help') || args.includes('-h') || (!phaseToRun && !runAll)) {
  showHelp();
  process.exit(0);
}

if (!apiKey) {
  console.error('\x1b[31mError: GEMINI_API_KEY is required.\x1b[0m');
  console.error('Provide it via:');
  console.error('  1. Environment variable: export GEMINI_API_KEY="your_key"');
  console.error('  2. In your .env file: GEMINI_API_KEY=your_key');
  console.error('  3. CLI argument: --key your_key\n');
  process.exit(1);
}

// Create reports directory if it doesn't exist
const reportsDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// Run the selected phase(s)
if (runAll) {
  runAllPhases();
} else {
  runSinglePhase(phaseToRun);
}

// Help message
function showHelp() {
  console.log('\n\x1b[36m=== Anarchy AI 18-Stage Audit Agent ===\x1b[0m');
  console.log('Usage: node anarchy_audit/agent_audit.js [phase_name] [options]');
  console.log('\nPhases available:');
  Object.keys(promptsConfig.phases).forEach(phase => {
    console.log(`  - \x1b[33m${phase}\x1b[0m: ${promptsConfig.phases[phase].title}`);
  });
  console.log('\nOptions:');
  console.log('  -a, --all        Run all 18 phases sequentially');
  console.log('  -k, --key <key>  Provide Gemini API Key directly');
  console.log('  -m, --model <m>  Gemini model to use (default: gemini-2.5-flash)');
  console.log('  -h, --help       Show this help screen');
  console.log('\nExamples:');
  console.log('  node anarchy_audit/agent_audit.js phase_1_architecture');
  console.log('  node anarchy_audit/agent_audit.js --all -k AIzaSy...\n');
}

// Scan files recursively with filters
function scanFiles(dir, allowedExts = [], ignoreDirs = []) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      if (ignoreDirs.includes(file) || file.startsWith('.') || file === 'node_modules' || file === 'dist' || file === 'setup_dist' || file === 'anarchy_audit') {
        return;
      }
      results = results.concat(scanFiles(fullPath, allowedExts, ignoreDirs));
    } else {
      const ext = path.extname(file).toLowerCase();
      if (allowedExts.length === 0 || allowedExts.includes(ext)) {
        // Skip large files (> 80KB) to prevent context bloating
        if (stat.size < 80000) {
          results.push(fullPath);
        }
      }
    }
  });

  return results;
}

// Generate code context representation
function buildContextForPhase(phase) {
  console.log(`\x1b[34mCollecting file context for ${phase}...\x1b[0m`);
  let context = '';
  let fileList = [];

  const addFileToContext = (filePath) => {
    if (fs.existsSync(filePath)) {
      const relativePath = path.relative(projectRoot, filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      context += `\n--- FILE: ${relativePath} ---\n${content}\n`;
      fileList.push(relativePath);
    }
  };

  switch (phase) {
    case 'phase_1_architecture':
      addFileToContext(path.join(projectRoot, 'package.json'));
      addFileToContext(path.join(projectRoot, 'vite.config.ts'));
      addFileToContext(path.join(projectRoot, 'tsconfig.json'));
      addFileToContext(path.join(projectRoot, 'src/main.tsx'));
      addFileToContext(path.join(projectRoot, 'src/App.tsx'));
      // List high level file names in src
      const srcFiles = scanFiles(path.join(projectRoot, 'src'), ['.ts', '.tsx', '.css']);
      context += '\n--- SOURCE FILE LIST ---\n';
      srcFiles.forEach(f => {
        context += `${path.relative(projectRoot, f)}\n`;
      });
      break;

    case 'phase_2_pages':
      const pageFiles = scanFiles(path.join(projectRoot, 'src/pages'), ['.ts', '.tsx']);
      const featureFiles = scanFiles(path.join(projectRoot, 'src/features'), ['.ts', '.tsx']);
      pageFiles.concat(featureFiles).forEach(addFileToContext);
      break;

    case 'phase_3_services':
      const serviceFiles = scanFiles(path.join(projectRoot, 'src/services'), ['.ts', '.js']);
      serviceFiles.forEach(addFileToContext);
      break;

    case 'phase_4_stores':
      const storeFiles = scanFiles(path.join(projectRoot, 'src/store'), ['.ts', '.js'])
        .concat(scanFiles(path.join(projectRoot, 'src/stores'), ['.ts', '.js']));
      storeFiles.forEach(addFileToContext);
      break;

    case 'phase_5_components':
      const componentFiles = scanFiles(path.join(projectRoot, 'src/components'), ['.ts', '.tsx']);
      componentFiles.slice(0, 15).forEach(addFileToContext); // cap it at 15 files
      break;

    case 'phase_6_typescript':
      addFileToContext(path.join(projectRoot, 'tsconfig.json'));
      addFileToContext(path.join(projectRoot, 'tsconfig.app.json'));
      addFileToContext(path.join(projectRoot, 'tsconfig.node.json'));
      const typeFiles = scanFiles(path.join(projectRoot, 'src/types'), ['.ts']);
      typeFiles.forEach(addFileToContext);
      break;

    case 'phase_7_performance':
      addFileToContext(path.join(projectRoot, 'vite.config.ts'));
      addFileToContext(path.join(projectRoot, 'src/hooks/useLazyImage.ts'));
      break;

    case 'phase_8_errors':
      // Fetch React app context & tauri-dev.log summary
      addFileToContext(path.join(projectRoot, 'src/App.tsx'));
      const logPath = path.join(projectRoot, 'tauri-dev.log');
      if (fs.existsSync(logPath)) {
        const logContent = fs.readFileSync(logPath, 'utf8');
        context += `\n--- TAURI LOG SUMMARY ---\n${logContent.slice(-5000)}\n`;
      }
      break;

    case 'phase_9_buttons_functionalities':
      addFileToContext(path.join(projectRoot, 'src/features/dashboard/ChangelogModal.tsx'));
      break;

    case 'phase_10_security':
      addFileToContext(path.join(projectRoot, '.env.example'));
      addFileToContext(path.join(projectRoot, 'src-tauri/tauri.conf.json'));
      break;

    case 'phase_11_quality_testing':
      addFileToContext(path.join(projectRoot, 'vitest.config.ts'));
      const testFiles = scanFiles(path.join(projectRoot, 'src/features/auth'), ['.test.tsx']);
      testFiles.forEach(addFileToContext);
      break;

    case 'phase_12_market_evaluation':
      addFileToContext(path.join(projectRoot, 'README.md'));
      break;

    case 'phase_13_ux_audit':
      addFileToContext(path.join(projectRoot, 'src/index.css'));
      break;

    case 'phase_14_qa_audit':
      addFileToContext(path.join(projectRoot, 'eslint.config.js'));
      const eslintReport = path.join(projectRoot, 'eslint-report.json');
      if (fs.existsSync(eslintReport)) {
        const report = fs.readFileSync(eslintReport, 'utf8');
        context += `\n--- ESLINT REPORT SAMPLE ---\n${report.slice(0, 10000)}\n`;
      }
      break;

    case 'phase_15_tauri_desktop':
      addFileToContext(path.join(projectRoot, 'src-tauri/tauri.conf.json'));
      addFileToContext(path.join(projectRoot, 'build_installer.ps1'));
      addFileToContext(path.join(projectRoot, 'installer.iss'));
      break;

    case 'phase_16_supabase_db':
      addFileToContext(path.join(projectRoot, 'create_predictions_table.sql'));
      break;

    case 'phase_17_stripe_billing':
      addFileToContext(path.join(projectRoot, 'AUTH_BILLING_STATUS.md'));
      break;

    case 'phase_18_final_roadmap':
      // Read all previously generated reports
      const reports = fs.readdirSync(reportsDir);
      reports.forEach(reportFile => {
        if (reportFile !== 'phase_18_final_roadmap.md' && reportFile.endsWith('.md')) {
          const content = fs.readFileSync(path.join(reportsDir, reportFile), 'utf8');
          context += `\n--- REPORT SUMMARY: ${reportFile} ---\n${content.slice(0, 3000)}\n`;
        }
      });
      break;

    default:
      console.log(`No specific context mapped for ${phase}. Utilizing general layout.`);
  }

  console.log(`Collected ${fileList.length} files for context.`);
  return context;
}

// Direct API call to Gemini
async function callGemini(promptText, codeContext) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const systemInstruction = `You are a Senior Software Quality Auditor. You are performing a structured 18-stage audit on the Anarchy AI application. 
Explain your findings in clear, professional English and Arabic. Detail visual components, potential issues, and clear solutions with code examples. Use Markdown formatting.`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `${promptText}\n\nHere is the codebase files/context for this phase:\n\n${codeContext}`
          }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction
        }
      ]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
    return json.candidates[0].content.parts[0].text;
  } else {
    throw new Error(`Unexpected Gemini response shape: ${JSON.stringify(json)}`);
  }
}

// Run a single phase of the audit
async function runSinglePhase(phase) {
  if (!promptsConfig.phases[phase]) {
    console.error(`\x1b[31mError: Phase "${phase}" is not defined in prompts.json\x1b[0m`);
    process.exit(1);
  }

  const title = promptsConfig.phases[phase].title;
  const promptText = promptsConfig.phases[phase].prompt;

  console.log(`\n\x1b[32m=== Starting Audit ${title} ===\x1b[0m`);
  
  try {
    const codeContext = buildContextForPhase(phase);
    console.log('\x1b[33mCalling Gemini API... (This might take a few seconds)\x1b[0m');
    const reportText = await callGemini(promptText, codeContext);

    const reportFileName = `${phase}.md`;
    const reportFilePath = path.join(reportsDir, reportFileName);
    
    fs.writeFileSync(reportFilePath, reportText, 'utf8');
    console.log(`\x1b[32m✔ Success! Report saved to: anarchy_audit/reports/${reportFileName}\x1b[0m\n`);
  } catch (error) {
    console.error(`\x1b[31m✘ Failed to run ${phase}: ${error.message}\x1b[0m\n`);
  }
}

// Run all phases sequentially
async function runAllPhases() {
  const phases = Object.keys(promptsConfig.phases);
  console.log(`\x1b[32mStarting complete 18-stage audit sequential run using model ${modelName}...\x1b[0m`);
  for (const phase of phases) {
    await runSinglePhase(phase);
  }
  console.log('\x1b[32m✔ Completed all 18 stages of the audit!\x1b[0m\n');
}
