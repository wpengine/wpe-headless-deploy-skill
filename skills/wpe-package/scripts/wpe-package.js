#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const [,, APP_NAME, BUILD_DIR = 'dist'] = process.argv;

if (!APP_NAME) {
  console.error('Usage: wpe-package.js <app-name> [build-dir]');
  console.error('  app-name   — used as the zip folder name and output filename');
  console.error('  build-dir  — directory containing the pre-built static files (default: dist)');
  process.exit(1);
}

const buildDir = path.resolve(BUILD_DIR);

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------
if (!fs.existsSync(buildDir)) {
  console.error(`Error: build directory not found: ${buildDir}`);
  console.error('Run your build command first (e.g. npm run build) then try again.');
  process.exit(1);
}

if (!fs.statSync(buildDir).isDirectory()) {
  console.error(`Error: ${buildDir} is not a directory.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Generate files
// ---------------------------------------------------------------------------
const packageJson = JSON.stringify({
  name: APP_NAME,
  version: '1.0.0',
  private: true,
  scripts: {
    build: 'echo "static build — nothing to build"',
    start: 'node server.js',
  },
  dependencies: {
    express: '^4.18.2',
  },
}, null, 2);

const serverJs = `const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'build')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;

const wpengineYaml = `# WP Engine Configuration
# Explicitly tell WP Engine this is a Node.js application

build:
  command: npm run build

start:
  command: node server.js

nodejs:
  version: 18

port: $PORT
`;

// ---------------------------------------------------------------------------
// Build zip structure in temp dir
// ---------------------------------------------------------------------------
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wpe-package-'));
const appDir  = path.join(tmpBase, APP_NAME);
fs.mkdirSync(appDir, { recursive: true });

console.log(`Packaging static site '${APP_NAME}' from: ${buildDir}\n`);

console.log('Writing server files...');
fs.writeFileSync(path.join(appDir, 'package.json'),    packageJson);
fs.writeFileSync(path.join(appDir, 'server.js'),        serverJs);
fs.writeFileSync(path.join(appDir, '.wpengine.yaml'),   wpengineYaml);
console.log('  package.json, server.js, .wpengine.yaml written');

console.log('Copying build directory...');
fs.cpSync(buildDir, path.join(appDir, 'build'), { recursive: true });
console.log(`  ${BUILD_DIR} -> ${APP_NAME}/build\n`);

// ---------------------------------------------------------------------------
// Zip
// ---------------------------------------------------------------------------
const outZip = path.resolve(`${APP_NAME}.zip`);
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
