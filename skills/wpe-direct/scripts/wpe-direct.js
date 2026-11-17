#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`Error: ${name} is required. Set it before running.`); process.exit(1); }
  return v;
}

const WPE_USER_ID    = requireEnv('WPE_USER_ID');
const WPE_API_SECRET = requireEnv('WPE_API_SECRET');
const WPE_ACCOUNT    = requireEnv('WPE_ACCOUNT');
const WPE_APP_ID     = requireEnv('WPE_APP_ID');
const WPE_WP_INSTALL = process.env.WPE_WP_INSTALL || '';

const BASE_URL   = 'https://js.wpengineapi.com/v1';
const UPLOAD_URL = 'https://js.wpengineapi.com/fu/v1';
const AUTH       = Buffer.from(`${WPE_USER_ID}:${WPE_API_SECRET}`).toString('base64');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function apiCall(method, endpoint, body) {
  const headers = { Authorization: `Basic ${AUTH}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE_URL + endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = 'unknown error';
    try { msg = JSON.parse(text).message || msg; } catch {}
    const err = new Error(`API returned HTTP ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

async function resolveEnvId(envName, appId = WPE_APP_ID) {
  const data = await apiCall('GET', `/accounts/${WPE_ACCOUNT}/apps/${appId}/environments`);
  const matches = (data.environments || [])
    .filter(e => e.displayName === envName)
    .sort((a, b) => a.createTime.localeCompare(b.createTime));
  const last = matches[matches.length - 1];
  if (!last) throw new Error(`environment '${envName}' not found in app '${appId}'. Run 'list' to see available environments.`);
  return last.name.split('/').pop();
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function cmdStatus() {
  console.log('=== WP Engine Headless Status ===');
  console.log(`  Account:    ${WPE_ACCOUNT}`);
  console.log(`  App:        ${WPE_APP_ID}`);
  console.log(WPE_WP_INSTALL
    ? `  WP Install: ${WPE_WP_INSTALL} (from WPE_WP_INSTALL)`
    : '  WP Install: not set (run list-installs and ask user to choose)');
  console.log('');

  const instRes = await fetch(
    `https://api.wpengineapi.com/v1/installs?account_name=${WPE_ACCOUNT}`,
    { headers: { Authorization: `Basic ${AUTH}` } }
  );
  if (instRes.status === 401 || instRes.status === 403) {
    console.log('Credentials: FAILED — check WPE_USER_ID and WPE_API_SECRET');
    process.exit(1);
  }
  if (!instRes.ok) {
    console.log(`Credentials: UNKNOWN — API returned HTTP ${instRes.status}`);
    process.exit(1);
  }
  const instData = await instRes.json();
  console.log('Credentials: OK\n');

  const firstInstall = instData.results?.[0]?.name;
  console.log(firstInstall
    ? `wpInstall (first available): ${firstInstall}`
    : 'wpInstall: none found — create a WordPress install in the WP Engine portal first');
  console.log('');

  const envRes = await fetch(
    `${BASE_URL}/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments`,
    { headers: { Authorization: `Basic ${AUTH}` } }
  );
  if (envRes.status === 404 || envRes.status === 400) {
    console.log(`App '${WPE_APP_ID}': NOT FOUND`);
    console.log(`  Next: run 'create-app ${WPE_APP_ID} regions/US-C' then 'create-env production <wpInstall>'`);
    return;
  }
  if (!envRes.ok) {
    console.log(`App '${WPE_APP_ID}': could not fetch environments (HTTP ${envRes.status})`);
    return;
  }
  const envData = await envRes.json();
  const envs = envData.environments || [];
  console.log(`Environments (${envs.length}):`);
  if (envs.length === 0) {
    console.log('  none');
    console.log("  Next: run 'create-env production <wpInstall>'");
  } else {
    for (const e of envs) {
      const url = 'https://' + (e.domains?.[0] ?? 'pending');
      console.log(`  - ${e.displayName} | url: ${url} | vars: ${e.shellVariables?.length ?? 0}`);
    }
  }
}

async function cmdList(appId = WPE_APP_ID) {
  console.log(`Listing environments for ${appId}...\n`);
  const data = await apiCall('GET', `/accounts/${WPE_ACCOUNT}/apps/${appId}/environments`);
  const envs = data.environments || [];
  if (envs.length === 0) { console.log(`No environments found for app '${appId}'.`); return; }
  console.log(`Found ${envs.length} environment(s):\n`);
  for (const e of envs) {
    console.log(`  - ${e.displayName}`);
    console.log(`    ID:       ${e.name.split('/').pop()}`);
    console.log(`    URL:      https://${e.domains?.[0] ?? 'pending'}`);
    console.log(`    Created:  ${e.createTime}`);
    console.log(`    Vars:     ${e.shellVariables?.length ?? 0} set\n`);
  }
}

async function waitForHttp(url) {
  console.log('Waiting for server to come up...');
  for (let i = 1; i <= 12; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.status >= 200 && res.status < 400) { console.log(`App is live at: ${url}`); return; }
      console.log(`  [${i}/12] HTTP ${res.status} — waiting...`);
    } catch {
      console.log(`  [${i}/12] no response — waiting...`);
    }
    await sleep(10000);
  }
  console.log(`Server did not respond within 2 minutes. Check: ${url}`);
}

async function verifyDomains(envId) {
  const res = await fetch(
    `${BASE_URL}/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments/${envId}/domainMappings`,
    { headers: { Authorization: `Basic ${AUTH}` } }
  );
  if (!res.ok) { console.log(`Could not fetch domain mappings (HTTP ${res.status})`); return; }
  const data = await res.json();
  const mappings = data.domainMappings || [];
  if (mappings.length === 0) { console.log('No domain mappings found.'); return; }

  console.log('Domain verification:');
  for (const { domain } of mappings) {
    const vRes = await fetch(
      `${BASE_URL}/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments/${envId}/domainMappings/${domain}:verifyTxtRecord`,
      { method: 'POST', headers: { Authorization: `Basic ${AUTH}`, 'Content-Type': 'application/json' }, body: '{}' }
    );
    if (!vRes.ok) { console.log(`  ${domain}: could not verify (HTTP ${vRes.status})`); continue; }
    const v = await vRes.json();

    if (domain.endsWith('.wpenginepowered.com')) {
      console.log(`  ${domain}: ACTIVE (WP Engine managed)`);
      await waitForHttp(`https://${domain}`);
      continue;
    }

    const state = v.state ?? 'UNKNOWN';
    if (state === 'ACTIVE') {
      console.log(`  ${domain}: ACTIVE${v.txtRecordVerifiedTime ? ' (TXT verified ' + v.txtRecordVerifiedTime + ')' : ''}`);
      await waitForHttp(`https://${domain}`);
    } else if (state === 'CREATING') {
      console.log(`  ${domain}: CREATING — provisioning in progress`);
    } else if (state === 'FAILED') {
      console.log(`  ${domain}: FAILED — check the WP Engine dashboard`);
    } else {
      console.log(`  ${domain}: ${state}`);
      if (v.txtVerificationName && v.txtVerificationValue) {
        console.log('  Add this DNS TXT record to verify ownership:');
        console.log(`    Name:  ${v.txtVerificationName}`);
        console.log(`    Value: ${v.txtVerificationValue}`);
      }
    }
  }
}

async function pollBuild(envId) {
  console.log('Waiting for build to complete (checking every 10s, timeout 6m)...');
  for (let i = 1; i <= 36; i++) {
    const res = await fetch(
      `${BASE_URL}/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments/${envId}/builds?pageSize=1&orderBy=createTime%20desc`,
      { headers: { Authorization: `Basic ${AUTH}` } }
    );
    if (!res.ok) {
      console.log(`  [${i}/36] Could not fetch build status (HTTP ${res.status}) — retrying...`);
      await sleep(10000);
      continue;
    }
    const data = await res.json();
    const state = data.builds?.[0]?.state ?? 'PENDING';
    if (state === 'SUCCEEDED') {
      console.log('  Build: SUCCEEDED\n');
      await verifyDomains(envId);
      return;
    }
    if (['FAILED', 'TIMEOUT', 'CANCELLED', 'CANCELLING'].includes(state)) {
      throw new Error(`Build: ${state} — check the WP Engine Headless dashboard for build logs.`);
    }
    console.log(`  [${i}/36] Build: ${state}...`);
    await sleep(10000);
  }
  throw new Error('Build still running after 6 minutes. Check the dashboard for status.');
}

async function cmdBuildStatus(envName) {
  if (!envName) throw new Error('Usage: build-status <envName>');
  const envId = await resolveEnvId(envName);
  console.log(`Recent builds for environment '${envName}':\n`);
  const res = await fetch(
    `${BASE_URL}/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments/${envId}/builds?pageSize=5&orderBy=createTime%20desc`,
    { headers: { Authorization: `Basic ${AUTH}` } }
  );
  if (!res.ok) throw new Error(`could not fetch builds (HTTP ${res.status})`);
  const data = await res.json();
  const builds = data.builds || [];
  if (builds.length === 0) { console.log("  No builds found. Run 'deploy' first."); return; }
  for (const b of builds) {
    let line = `  ${b.state} | ${b.trigger} | started: ${b.startTime ?? b.createTime}`;
    if (b.finishTime) line += ` | finished: ${b.finishTime}`;
    console.log(line);
  }
}

async function cmdDeploy(zipFile, envName) {
  if (!zipFile || !envName) throw new Error('Usage: deploy <zipFile> <envName>');
  if (!fs.existsSync(zipFile)) throw new Error(`file not found: ${zipFile}`);

  console.log('Deploying to WP Engine Headless');
  console.log(`  App:         ${WPE_APP_ID}`);
  console.log(`  Environment: ${envName}`);
  console.log(`  Package:     ${zipFile}\n`);

  const envId = await resolveEnvId(envName);
  console.log(`Resolved environment ID: ${envId}\n`);
  console.log('Uploading deployment package...');

  const form = new FormData();
  form.append('repository', new Blob([fs.readFileSync(zipFile)]), path.basename(zipFile));
  const uploadUrl = `${UPLOAD_URL}/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments/${envId}:upload`;
  const uploadOpts = { method: 'POST', headers: { Authorization: `Basic ${AUTH}` }, body: form };

  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(uploadUrl, uploadOpts);
    if (res.ok || res.status < 500) break;
    const delay = 5000 * Math.pow(2, attempt);
    console.log(`  Upload returned HTTP ${res.status} — retrying in ${delay / 1000}s (${attempt + 1}/3)...`);
    await sleep(delay);
    const retryForm = new FormData();
    retryForm.append('repository', new Blob([fs.readFileSync(zipFile)]), path.basename(zipFile));
    uploadOpts.body = retryForm;
  }
  if (!res.ok) throw new Error(`upload failed with HTTP ${res.status}`);
  console.log(`Upload successful! (HTTP ${res.status})\n`);
  await pollBuild(envId);
}

async function cmdCreateEnv(envName, wpInstall) {
  if (!envName) throw new Error('Usage: create-env <name> <wpInstall>');
  const wp = wpInstall || WPE_WP_INSTALL;
  if (!wp) throw new Error('wpInstall is required. Set WPE_WP_INSTALL or pass it as the second argument. Run list-installs to see options.');
  console.log(`Creating environment '${envName}' in app '${WPE_APP_ID}'...\n`);
  const data = await apiCall('POST', `/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments`, {
    displayName: envName, branch: 'uploadable', wpEnvironment: wp, shellVariables: [],
  });
  const envId = data.metadata?.envId;
  if (envId) { console.log('Environment created successfully.'); console.log(`  ID: ${envId}`); }
  else { console.log('Response from API:'); console.log(JSON.stringify(data, null, 2)); }
}

async function cmdUpdateEnv(envName, ...pairs) {
  if (!envName) throw new Error('Usage: update-env <name> KEY=VALUE ...');
  if (pairs.length === 0) throw new Error('No environment variables provided.');
  const envId = await resolveEnvId(envName);
  const envData = await apiCall('GET', `/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments`);
  const env = (envData.environments || []).filter(e => e.displayName === envName).pop();
  const shellVariables = pairs
    .filter(p => p.includes('='))
    .map(p => ({ key: p.slice(0, p.indexOf('=')), value: p.slice(p.indexOf('=') + 1) }));
  console.log(`Updating environment variables for '${envName}':`);
  for (const { key } of shellVariables) console.log(`  ${key}=***`);
  console.log('');
  await apiCall('PATCH', `/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments/${envId}`, {
    displayName: envName, branch: 'uploadable', wpEnvironment: env?.wpEnvironment ?? '', shellVariables,
  });
  console.log('Environment variables updated.');
  console.log('Note: redeploy the app for changes to take effect.');
}

async function cmdDeleteEnv(envName, ...rest) {
  if (!envName) throw new Error('Usage: delete-env <name> --confirm');
  if (!rest.includes('--confirm')) {
    console.error('Error: deleting an environment is irreversible.');
    console.error(`Re-run with --confirm to proceed: delete-env ${envName} --confirm`);
    process.exit(1);
  }
  const envId = await resolveEnvId(envName);
  console.log(`Deleting environment '${envName}' (ID: ${envId})...`);
  const res = await fetch(
    `${BASE_URL}/accounts/${WPE_ACCOUNT}/apps/${WPE_APP_ID}/environments/${envId}`,
    { method: 'DELETE', headers: { Authorization: `Basic ${AUTH}` } }
  );
  if (!res.ok && res.status !== 404) throw new Error(`delete failed with HTTP ${res.status}`);
  console.log(`Environment '${envName}' deleted.`);
}

async function cmdVerifyDomain(envName) {
  if (!envName) throw new Error('Usage: verify-domain <envName>');
  const envId = await resolveEnvId(envName);
  console.log(`Checking domain mappings for environment '${envName}'...\n`);
  await verifyDomains(envId);
}

async function cmdListInstalls() {
  console.log(`Listing WordPress installs for account '${WPE_ACCOUNT}'...\n`);
  const res = await fetch(
    `https://api.wpengineapi.com/v1/installs?account_name=${WPE_ACCOUNT}`,
    { headers: { Authorization: `Basic ${AUTH}` } }
  );
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`API returned HTTP ${res.status}: ${data.message ?? 'unknown error'}`);
  }
  const data = await res.json();
  const results = data.results || [];
  if (results.length === 0) { console.log(`No WordPress installs found in account '${WPE_ACCOUNT}'.`); return; }
  console.log(`Found ${results.length} install(s) — pass one of these names as <wpInstall> to create-env:\n`);
  for (const r of results) console.log(`  - ${r.name}  (${r.environment})`);
}

async function cmdDeleteApp(...args) {
  const confirmed = args.includes('--confirm');
  const id = args.find(a => a !== '--confirm') || WPE_APP_ID;
  if (!confirmed) {
    console.error('Error: deleting an app is irreversible.');
    console.error(`Re-run with --confirm to proceed: delete-app ${id} --confirm`);
    process.exit(1);
  }
  console.log(`Deleting app '${id}'...`);
  await apiCall('DELETE', `/accounts/${WPE_ACCOUNT}/apps/${id}`);
  console.log(`App '${id}' deleted.`);
}

async function cmdCreateApp(appId, region = 'regions/US-C') {
  const id = appId || WPE_APP_ID;
  console.log(`Creating app '${id}' in region '${region}'...\n`);
  try {
    await apiCall('POST', `/accounts/${WPE_ACCOUNT}/apps?app_id=${id}`, { region, uploadable: {} });
    console.log(`App '${id}' created successfully.`);
  } catch (e) {
    if (e.status === 400) { console.log(`App '${id}' already exists.`); }
    else throw e;
  }
}

async function cmdFull(envName = 'production') {
  let scripts = '';
  try { scripts = execSync('npm run --silent', { encoding: 'utf8' }); } catch {}
  if (!scripts.includes('build')) throw new Error("no 'build' script found in package.json. Add a build script or use 'deploy' with a pre-built zip.");
  if (!scripts.includes('package')) throw new Error("no 'package' script found in package.json. Add a package script or use 'deploy' with a pre-built zip.");
  console.log('Building application...');
  execSync('npm run build', { stdio: 'inherit' });
  console.log('\nCreating deployment package...');
  execSync('npm run package', { stdio: 'inherit' });
  console.log('');
  await cmdDeploy('wpe-deploy.zip', envName);
}

function cmdHelp() {
  console.log(`WP Engine Headless Direct API Skill

Commands:
  status                          Show credentials, environments, and first available wpInstall
  list [appId]                    List environments for an app
  list-installs                   List WordPress installs available to link as wpInstall
  deploy <zipFile> <envName>      Deploy a zip, poll for build completion, print live URL
  build-status <envName>          Show recent build history (non-blocking)
  verify-domain <envName>         Verify domain mappings for an environment
  create-env <name> <wpInstall>   Create a new environment
  update-env <name> KEY=VAL ...   Set environment variables
  delete-env <name> --confirm     Delete an environment
  create-app [appId] [region]     Create a new app (regions: US-C EU-W UK AUS-SE)
  delete-app [appId] --confirm    Delete an app entirely
  full [envName]                  Build, package, and deploy (requires npm scripts)
  help                            Show this help

Required env vars: WPE_USER_ID, WPE_API_SECRET, WPE_ACCOUNT, WPE_APP_ID
Load from .env:    set -a; source .env; set +a

API: https://js.wpengineapi.com/v1  |  Requires: node (v18+), curl`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const [,, cmd = 'help', ...args] = process.argv;
  switch (cmd) {
    case 'status':        return cmdStatus();
    case 'list':          return cmdList(args[0]);
    case 'list-installs': return cmdListInstalls();
    case 'deploy':        return cmdDeploy(args[0], args[1]);
    case 'build-status':  return cmdBuildStatus(args[0]);
    case 'verify-domain': return cmdVerifyDomain(args[0]);
    case 'create-env':    return cmdCreateEnv(args[0], args[1]);
    case 'update-env':    return cmdUpdateEnv(args[0], ...args.slice(1));
    case 'delete-env':    return cmdDeleteEnv(args[0], ...args.slice(1));
    case 'create-app':    return cmdCreateApp(args[0], args[1]);
    case 'delete-app':    return cmdDeleteApp(...args);
    case 'full':          return cmdFull(args[0]);
    case 'help': case '--help': case '-h': return cmdHelp();
    default:
      console.error(`Unknown command: ${cmd}\n`);
      cmdHelp();
      process.exit(1);
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
