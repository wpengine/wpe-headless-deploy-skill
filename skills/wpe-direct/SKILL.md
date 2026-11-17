---
name: wpe-direct
description: Deploy an app to WP Engine Headless (Atlas) via direct upload — handles credentials, app and environment setup, packaging, and zip upload. Use when asked to deploy to WP Engine, WP Engine Headless, or Atlas, or when setting up a WP Engine deployment workflow.
version: 3.0.0
---

# WP Engine Headless — Direct Upload Skill

Use this skill to authenticate, create apps and environments, and deploy application zips
directly to the WP Engine Headless platform API.

## Available scripts

- **`scripts/wpe-direct.js`** — all API operations: list, deploy, create/update/delete environments and apps

## Prerequisites

`node` (v18+) must be installed. Node.js: https://nodejs.org — no other tools required.

## WP Engine compatibility gate — MANDATORY

Run this gate **before every one of** `create-app`, `create-env`, packaging,
`deploy`, and any redeploy of an existing app. This requirement also applies
to existing WP Engine apps and redeployments. Do not infer compatibility from
a previous successful build, from a green local smoke test, or from binaries
discovered inside the container.

If the gate fails, **stop before** `create-app`, `create-env`, packaging, or
upload. Do not create WP Engine resources while waiting for a fix decision.

### Supported runtime contract

Atlas is framework-agnostic for Node.js-based front ends. The **only**
supported production runtimes are:

- Node.js application code
- Browser/static assets
- Dependencies installed through the packaged Node.js dependency manifest
  (`package.json` / lockfile)
- WP Engine-supported framework adapters

Supported patterns:

- **Rendering modes:** SSR, SSG, and ISR
- **Frameworks:** Faust.js; Next.js, Remix, Gatsby; Nuxt; Astro, SvelteKit,
  SolidStart, QwikCity
- **Custom environments:** any framework with a standard Node.js adapter, or
  one that compiles to static output served by `http-server`, Express, or an
  equivalent Node.js production server

### Runtime allowlist — hard rules

Application code must execute entirely in the supported Node.js runtime **or**
compile to static browser assets. Before packaging, search production code and
scripts for subprocess execution through `child_process`, `exec`, `execFile`,
`spawn`, shell scripts, or equivalent APIs.

**Reject the deployment** when these calls require an external runtime or
executable not explicitly on the allowlist. Examples that must be rejected:

- `perl`, `python`, `ruby`, `php`, `java`, `go`, `rust`
- Locally installed CLIs (`ffmpeg`, `imagemagick`, `pandoc`, etc.)
- Arbitrary system binaries
- OS-package dependencies (apt, brew, nix)
- Writable local persistence (SQLite files, on-disk state)
- Replit-, Vercel-, or Netlify-specific runtime services

**The presence of an executable during local testing does not establish
platform support.** Replit and similar dev environments ship binaries WP
Engine does not officially support. A local smoke test proves the local
environment works — it does not prove WP Engine will.

### Pre-gate checklist

Before `create-app`, `create-env`, packaging, or deploy, verify:

1. Framework and rendering mode are selected.
2. Reproducible production build command exists.
3. SSR/ISR projects have a production start command.
4. Production server binds to `0.0.0.0` and reads `process.env.PORT`.
5. No dependency on host-specific runtime services (Replit, Vercel, Netlify
   serverless-only APIs), local filesystem state, or a development server.
6. **No subprocess calls to unsupported runtimes** (see allowlist above).
7. Package format matches the project:
   - Next.js source → `wpe-next`
   - Static/SPA → `wpe-package`
   - Other SSR/ISR → framework-specific or custom Node.js package with
     a valid start command and `.wpengine.yaml`
8. Local build + start smoke test pass **and** the runtime allowlist check
   passes.

### When the gate fails

If any check fails, stop and explain the exact incompatibility to the user.
Offer compatible alternatives:

- Rewrite the offending runtime in Node.js.
- Deploy the unsupported backend to a compatible external service and call it
  over HTTPS from the Node.js app.
- Choose another hosting platform.

Do not create or update WP Engine resources until the user picks one.

Creating an app or environment through the WP Engine API does not validate
framework compatibility. A successful API call only creates the platform
resource; the project still has to satisfy the build and runtime contract.

## Credentials

Four variables are required. Before running any command, check the project root for a `.env` file containing all four:

```
WPE_USER_ID      # WP Engine API user ID
WPE_API_SECRET   # WP Engine API secret
WPE_ACCOUNT      # account slug (visible in portal URL: my.wpengine.com/accounts/<slug>)
WPE_APP_ID       # app name/ID for this project on WP Engine
WPE_WP_INSTALL   # optional: WordPress install to link environments to (can be resolved later)
```

**If `.env` is missing, empty, or any variable has no value, do not ask the user to edit a file.** Treat an empty file and a missing file the same way. Instead:

1. Tell the user you need their WP Engine API credentials before you can continue.
2. Ask them to go to **my.wpengine.com → API Access → Generate Credentials**. The API Secret is shown only once — they must copy it immediately.
3. Collect each missing value conversationally:
   - "Please paste your **WP Engine User ID**" (the long ID shown in API Access)
   - "Please paste your **API Secret**" (shown once when you click Generate Credentials)
   - "What is your **WP Engine account name**? You can find it in the URL when logged in: `my.wpengine.com/accounts/YOUR-ACCOUNT`"
   - "What would you like to **name this app**? It becomes its permanent ID on WP Engine — lowercase letters and hyphens only."
4. Write the `.env` file with the values provided. Do not display credentials back to the user.
5. Ensure `.env` is listed in `.gitignore`.

Load credentials before every script call:

```bash
set -a; source .env; set +a
```

## Deployment workflow

When asked to deploy, run the following as a **single guided operation** — do not present these as manual steps for the user to execute. The only moment requiring user input is wpInstall selection when multiple options exist.

**Step 1 — Credentials.** Ensure `.env` has all four required variables. Set up any that are missing before continuing (see Credentials above).

**Step 2 — Status check.** Run `status` to confirm credentials, see existing environments, and identify available WordPress installs:

```bash
set -a; source .env; set +a
node scripts/wpe-direct.js status
```

Read the output before proceeding — it tells you what already exists and what needs to be created.

**Step 3 — Create app if needed.** If the status output shows the app doesn't exist, create it automatically:

```bash
node scripts/wpe-direct.js create-app "$WPE_APP_ID" regions/US-C
```

**Step 4 — Resolve wpInstall and create environment if needed.** If no environments exist yet:

- If `WPE_WP_INSTALL` is set in `.env`, use it — no prompt needed.
- If the status output shows exactly one WordPress install available, use it — no prompt needed.
- If multiple installs are listed and none is pre-configured, show them to the user and ask: _"Which WordPress install should this app be linked to?"_ This is the only step that requires user input.

```bash
node scripts/wpe-direct.js list-installs          # only if wpInstall is unresolved
node scripts/wpe-direct.js create-env production <wpInstall>
```

**Step 5 — Deploy.**

```bash
node scripts/wpe-direct.js deploy "$WPE_APP_ID.zip" production
```

**Step 6 — Report.** The script polls for build completion and prints the live URL. Tell the user in plain language: _"Your app is deployed and available at [URL]. It may take 2–5 minutes to finish starting up."_ Do not surface build logs or raw output unless there is a failure.

## Error handling

When a script returns an error, **do not relay raw shell output to the user**. Instead:

1. Read `references/troubleshooting.md` to identify the cause.
2. If the error is recoverable without user input (wrong path, app already exists, build lock) — fix it and retry silently.
3. If user input is genuinely needed (expired credentials, a choice between options) — explain what went wrong in one plain sentence and ask only for what is required.
4. Never surface raw HTTP status codes, `jq` errors, or bash stack traces to the user.

## Common commands

Before any command: `set -a; source .env; set +a`

```bash
node scripts/wpe-direct.js status                                # confirm credentials, envs, and first wpInstall
node scripts/wpe-direct.js list                                  # list environments
node scripts/wpe-direct.js deploy app.zip production             # deploy a zip, poll for build completion, print live URL
node scripts/wpe-direct.js build-status production               # show recent build history (non-blocking)
node scripts/wpe-direct.js create-env staging <wpInstall>        # new environment
node scripts/wpe-direct.js update-env production KEY=VALUE       # set env vars
node scripts/wpe-direct.js delete-env staging --confirm          # delete (--confirm required)
node scripts/wpe-direct.js create-app my-app regions/US-C        # create app
node scripts/wpe-direct.js delete-app my-app --confirm           # delete app entirely (--confirm required)
```

## Gotchas

- **Upload uses a different base path.** The deploy endpoint is `/fu/v1/...` not `/v1/...`. The script handles this automatically.
- **Environment names are matched by `displayName`, not ID.** Names must match exactly (case-sensitive). Run `list` and copy the name character-for-character.
- **Every headless environment must be linked to a WordPress install**, even for pure Node.js apps — this is a WP Engine platform requirement. The app doesn't need to talk to WordPress; the link is mandatory at the API level.
- **Env var changes don't take effect until the next deploy.** After `update-env`, run `deploy` again.
- **`delete-env` requires `--confirm`.** There is no interactive prompt — the flag is the only way to proceed.
- **The zip must have a top-level folder named after the app.** A flat zip (files at root) will be rejected. Use the `wpe-package` skill to produce the correct structure.
- **Build SUCCEEDED ≠ app is serving.** The WP Engine build API reports `SUCCEEDED` when the artifact is ready, but the container takes additional time to start. `deploy` polls the live URL and only reports success once the server actually responds.

## API limitations

- **Build lock (HTTP 409).** After a deploy upload, WP Engine starts an async build. Until it completes (typically 2–5 minutes), `update-env`, `delete-env`, and `delete-app` return HTTP 409. Wait and retry.
- **App names are permanently reserved.** Once created or deleted, the same name cannot be reused — the API returns 400. Use a new unique name for each app.
- **`update-env` requires a prior deploy.** Running `update-env` on a freshly created environment (before any deploy) returns HTTP 500. Always deploy first.

## Troubleshooting

If a step fails, read `references/troubleshooting.md`:

```bash
node scripts/wpe-direct.js help
```
