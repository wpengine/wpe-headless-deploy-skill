# WP Engine Headless — Replit Setup Guide

This guide walks you through setting up the WP Engine deployment skills in
Replit. Everything is done through the Replit UI — no terminal commands needed.

## Before you start

You will need:

- A **Replit** account with an active Repl (the project you want to deploy)
- The **skills zip file** you received (unzip it on your computer first)
- Your **WP Engine API credentials** — get them from the
  [WP Engine User Portal](https://my.wpengine.com) → **API Access** →
  **Generate Credentials**. You will see a User ID and API Secret (the secret
  is shown only once — copy it immediately)

## Step 1 — Add the four skills

1. Open your Repl in Replit.
2. Click the **Settings** gear icon in the left sidebar.
3. Go to **Customization → Skills**.
4. For each of the four skills below, click **Add → Write a skill** and fill
   in the **Name**, **Description**, and **Instructions** fields, then set
   sharing to **Required** and click **Create skill**.

### Skill 1: wpe-direct

- **Name:** `wpe-direct`
- **Description:** Deploy an app to WP Engine Headless (Atlas) via direct
  upload — handles credentials, app and environment setup, packaging, and zip
  upload.
- **Instructions:** Open `skills/wpe-direct/SKILL.md` from the zip. Copy
  everything **below** the closing `---` line (skip the frontmatter block at
  the top) and paste it here.

### Skill 2: wpe-package

- **Name:** `wpe-package`
- **Description:** Package a static or SPA site (React, Vue, Svelte) for WP
  Engine Headless — wraps the build output in an Express server and creates the
  zip structure required for upload.
- **Instructions:** Open `skills/wpe-package/SKILL.md` from the zip. Copy
  everything below the closing `---` line and paste it here.

### Skill 3: wpe-next

- **Name:** `wpe-next`
- **Description:** Package and deploy a Next.js app to WP Engine Headless —
  SSR, App Router, and API routes are fully supported.
- **Instructions:** Open `skills/wpe-next/SKILL.md` from the zip. Copy
  everything below the closing `---` line and paste it here.

### Skill 4: replit-default-deployment

- **Name:** `replit-default-deployment`
- **Description:** When running inside Replit, keep Replit Autoscale as the
  default deployment target unless the user explicitly requests another
  platform or deployment type.
- **Instructions:** Open `skills/replit-default-deployment/SKILL.md` from the
  zip. Copy everything below the closing `---` line and paste it here.

## Step 2 — Add the Customization Instructions

1. In **Settings → Customization**, find the **Instructions** text box (this
   is separate from the Skills section).
2. Open `CUSTOMIZATION-INSTRUCTIONS.md` from the zip on your computer.
3. Copy the entire content inside the code block (everything between the
   triple-backtick fences).
4. Paste it into the **Instructions** field and save.

These instructions enforce compatibility checks that prevent the agent from
deploying code that won't run on WP Engine.

## Step 3 — Upload the support files to your Repl

Using the **file tree** in the left sidebar of your Repl:

1. **Drag `replit.md`** from the unzipped folder into the **root** of your
   Repl's file tree. This file tells the agent about Replit-specific deployment
   defaults.

2. **Drag the entire `skills/` folder** from the unzipped folder into the
   **root** of your Repl's file tree. The agent needs the deployment scripts
   inside this folder to package and upload your app.

After uploading, your Repl's file tree should include:

```
your-repl/
├── replit.md
├── skills/
│   ├── wpe-direct/
│   │   └── scripts/
│   │       └── wpe-direct.js
│   ├── wpe-next/
│   │   └── scripts/
│   │       └── wpe-next.js
│   └── wpe-package/
│       └── scripts/
│           └── wpe-package.js
├── ... (your existing project files)
```

## Step 4 — Add your WP Engine credentials

1. In the left sidebar, click the **lock icon** to open the **Secrets** tab
   (or go to **Tools → Secrets**).
2. Add these secrets:

   | Key | Value |
   |-----|-------|
   | `WPE_USER_ID` | Your WP Engine API User ID |
   | `WPE_API_SECRET` | Your WP Engine API Secret |

3. Optionally, add `WPE_APP_NAME` with your WP Engine app name. If you skip
   this, the agent will ask you for it during deployment.

## Step 5 — Deploy your app

1. Start a **new agent session** (click the Agent chat or open a new chat).
2. Type: **"Deploy my app to WP Engine"**
3. The agent will:
   - Run the compatibility gate to check your app works on WP Engine
   - Ask you for any missing information (app name, environment name, etc.)
   - Build, package, and deploy your app
   - Report back with the live URL

## Troubleshooting

**"Where should I deploy: Replit or another platform?"** — This is the
deployment target resolution gate working correctly. Answer "WP Engine" or
"WP Engine Headless" to proceed.

**Agent skips the compatibility check** — Make sure the Customization
Instructions (Step 2) are saved. Start a new agent session after saving — the
instructions are loaded at session start.

**"Missing environment variable" errors** — Double-check that `WPE_USER_ID`
and `WPE_API_SECRET` are set in the Secrets tab (Step 4). Secret names are
case-sensitive.

**Agent can't find the scripts** — Verify the `skills/` folder is in your
Repl's project root (Step 3) and contains the `scripts/` subdirectories with
the `.js` files.

**Build fails on WP Engine** — Your app must run on Node.js only. Python,
Ruby, PHP, and other runtimes are not supported. If your app uses subprocess
calls to non-Node executables, the compatibility gate should catch this — if
it didn't, check that the skills and instructions are installed correctly.
