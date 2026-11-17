#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const [,, APP_NAME = 'app', OUTPUT_DIR = '.'] = process.argv;

const CWD    = process.cwd();
const outDir = path.resolve(OUTPUT_DIR);

// ---------------------------------------------------------------------------
// Validate project
// ---------------------------------------------------------------------------
const pkgPath = path.join(CWD, 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('Error: No package.json found in the current directory.');
  console.error('Make sure you are in your Next.js project folder.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies, pkg.peerDependencies);

if (!allDeps.next) {
  console.error("Error: 'next' not found in package.json dependencies.");
  console.error("Make sure you're in a Next.js project folder.");
  process.exit(1);
}

if (!pkg.scripts?.build) {
  console.error("Error: No 'build' script found in package.json.");
  console.error('Add "build": "next build" to your package.json scripts.');
  process.exit(1);
}

if (!pkg.scripts?.start) {
  console.error("Error: No 'start' script found in package.json.");
  console.error('Add "start": "next start" to your package.json scripts.');
  process.exit(1);
}

// Check for standalone mode in any next.config file
const nextConfigs = ['next.config.js', 'next.config.mjs', 'next.config.ts', 'next.config.cjs'];
for (const cfg of nextConfigs) {
  const cfgPath = path.join(CWD, cfg);
  if (fs.existsSync(cfgPath)) {
    const cfgContent = fs.readFileSync(cfgPath, 'utf8');
    if (cfgContent.includes("output:") && cfgContent.includes("standalone")) {
      console.error(`Error: 'output: standalone' detected in ${cfg}.`);
      console.error("Remove 'output: \\'standalone\\'' from your Next.js config — source deployment is incompatible with standalone mode.");
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Detect Node version
// ---------------------------------------------------------------------------
function detectNodeVersion() {
  const nvmrc = path.join(CWD, '.nvmrc');
  if (fs.existsSync(nvmrc)) {
    const v = fs.readFileSync(nvmrc, 'utf8').trim().replace(/^v/, '');
    const major = parseInt(v, 10);
    if (!isNaN(major)) return major;
  }

  const nodeVersion = path.join(CWD, '.node-version');
  if (fs.existsSync(nodeVersion)) {
    const v = fs.readFileSync(nodeVersion, 'utf8').trim().replace(/^v/, '');
    const major = parseInt(v, 10);
    if (!isNaN(major)) return major;
  }

  const enginesNode = pkg.engines?.node;
  if (enginesNode) {
    const match = enginesNode.match(/\d+/);
    if (match) return parseInt(match[0], 10);
  }

  return 20;
}

const NODE_VERSION = detectNodeVersion();

// ---------------------------------------------------------------------------
// Recursive copy with excludes
// ---------------------------------------------------------------------------
const EXCLUDES = new Set([
  'node_modules',
  '.next',
  '.git',
  '.turbo',
  '.yarn',
  'coverage',
  'storybook-static',
]);

const EXCLUDE_SUFFIXES = ['.zip', '.DS_Store'];
const EXCLUDE_PREFIXES = ['.env'];

function shouldExclude(name) {
  if (EXCLUDES.has(name)) return true;
  if (EXCLUDE_SUFFIXES.some(s => name.endsWith(s))) return true;
  if (EXCLUDE_PREFIXES.some(p => name.startsWith(p))) return true;
  return false;
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (shouldExclude(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// ---------------------------------------------------------------------------
// .wpengine.yaml
// ---------------------------------------------------------------------------
const wpengineYaml = `build:
  command: npm run build
start:
  command: npm run start
nodejs:
  version: ${NODE_VERSION}
port: $PORT
`;

// ---------------------------------------------------------------------------
// Build structure in temp dir
// ---------------------------------------------------------------------------
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wpe-next-'));
const appDir  = path.join(tmpBase, APP_NAME);
fs.mkdirSync(appDir, { recursive: true });

console.log(`Packaging Next.js app '${APP_NAME}'`);
console.log(`  Source:    ${CWD}`);
console.log(`  Node:      ${NODE_VERSION}`);
console.log(`  Output:    ${outDir}/${APP_NAME}.zip\n`);

console.log('Copying source files (excluding node_modules, .next, .env*, etc.)...');
copyRecursive(CWD, appDir);
console.log('  Done.\n');

console.log('Writing .wpengine.yaml...');
fs.writeFileSync(path.join(appDir, '.wpengine.yaml'), wpengineYaml);
console.log(`  nodejs: ${NODE_VERSION}, build + start commands written\n`);

// ---------------------------------------------------------------------------
// Zip
// ---------------------------------------------------------------------------
const outZip = path.join(outDir, `${APP_NAME}.zip`);
if (fs.existsSync(outZip)) fs.unlinkSync(outZip);

console.log('Creating deployment package...');
execSync(`zip -r ${JSON.stringify(outZip)} ${JSON.stringify(APP_NAME)}`, {
  cwd: tmpBase, stdio: ['ignore', 'pipe', 'pipe'],
});

// Clean up temp dir
fs.rmSync(tmpBase, { recursive: true, force: true });

const size = (fs.statSync(outZip).size / 1024 / 1024).toFixed(2);
console.log(`\nPackage ready: ${outZip} (${size} MB)`);
console.log('\nNext step:');
console.log(`  node scripts/wpe-direct.js deploy ${APP_NAME}.zip production`);
