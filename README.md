# WP Engine Headless Deployment Skills

Claude Code skills for deploying applications to the [WP Engine Headless platform](https://developers.wpengine.com/docs/headless-platform/) via the direct upload API. Designed for teams using VCS not natively integrated with WP Engine (Azure Repos, self-hosted GitLab or Bitbucket, etc.).

Packaged as an [Agent Skills](https://agentskills.io) plugin — works with Claude Code, Cursor, GitHub Copilot, VS Code, Gemini CLI, OpenAI Codex, Roo Code, and any other [Agent Skills-compatible tool](https://agentskills.io).

## Skills

| Skill | Purpose |
|---|---|
| `wpe-direct` | Authenticate, create apps/environments, and deploy zips via the WP Engine API |
| `wpe-package` | Wrap a pre-built static/SPA site in an Express server and zip it into the structure WP Engine requires (React, Vue, Svelte — not SSR frameworks) |
| `wpe-next` | Package and deploy a Next.js app — SSR, App Router, and API routes fully supported |
| `replit-default-deployment` | When a session is running inside Replit, keeps Autoscale as the default target and gates target resolution before any scaffolding |

## Install

### Claude Code

Unzip the skills package, then:

1. **Register the marketplace** — from your shell (not inside Claude Code):

   ```bash
   claude plugin marketplace add /path/to/headless-deployment-skill
   ```

2. **Discover and install** — open Claude Code and run:

   ```
   /plugin
   ```

   This opens the **Discover** tab. Find `wpe-headless-deploy` and install it.
   All four skills (`wpe-direct`, `wpe-package`, `wpe-next`,
   `replit-default-deployment`) are included in the plugin.

3. **Restart** Claude Code. Skills are picked up at session start.

> You can also list installed plugins from your shell with `claude plugin list`.

### Manual

If you prefer not to use the plugin system, copy the skill folders directly:

```bash
mkdir -p .claude/skills
cp -r /path/to/headless-deployment-skill/skills/wpe-direct                 .claude/skills/
cp -r /path/to/headless-deployment-skill/skills/wpe-package                .claude/skills/
cp -r /path/to/headless-deployment-skill/skills/wpe-next                   .claude/skills/
cp -r /path/to/headless-deployment-skill/skills/replit-default-deployment  .claude/skills/
```

Then restart Claude Code.

### Replit

You will receive the skills as a zip file. Unzip it to find the `skills/`
folder containing the four skill directories.

#### Step 1 — Add skills via the Replit UI

1. In your Repl, go to **Settings → Customization → Skills**.
2. Click **Add → Write a skill**.
3. Create each skill by filling in the fields below. For the **Instructions**
   field, open the matching `SKILL.md` file from the zip and copy everything
   below the `---` frontmatter block.

   | Name | Description |
   |------|-------------|
   | `wpe-direct` | Deploy an app to WP Engine Headless (Atlas) via direct upload — handles credentials, app and environment setup, packaging, and zip upload. |
   | `wpe-package` | Package a static or SPA site (React, Vue, Svelte) for WP Engine Headless — wraps the build output in an Express server and creates the zip structure required for upload. |
   | `wpe-next` | Package and deploy a Next.js app to WP Engine Headless — SSR, App Router, and API routes are fully supported. |
   | `replit-default-deployment` | When running inside Replit, keep Replit Autoscale as the default deployment target unless the user explicitly requests another platform or deployment type. |

4. Set sharing to **Required** for each skill, then click **Create skill**.

#### Step 2 — Add the guardrails to Customization Instructions

1. Go to **Settings → Customization → Instructions**.
2. Open `CUSTOMIZATION-INSTRUCTIONS.md` from the zip and copy the entire code
   block inside it.
3. Paste it into the instructions field and save.

#### Step 3 — Upload support files

1. From the zip, drag `replit.md` into your Repl's project root using the
   file tree in the sidebar.
2. From the zip, drag the entire `skills/` folder into your Repl. The agent
   needs the deployment scripts at `skills/wpe-direct/scripts/`,
   `skills/wpe-next/scripts/`, and `skills/wpe-package/scripts/`.

#### Step 4 — Set credentials

1. Open the **Secrets** tab in your Repl (lock icon in the Tools panel).
2. Add the following secrets:

   | Secret | Value |
   |--------|-------|
   | `WPE_USER_ID` | Your WP Engine API User ID |
   | `WPE_API_SECRET` | Your WP Engine API Secret |
   | `WPE_APP_NAME` | Your WP Engine app name (optional — the agent will ask if missing) |

#### Step 5 — Deploy

Start a new agent session and ask _"Deploy my app to WP Engine"_. The skills
and customization instructions will enforce the compatibility gate and
deployment target resolution automatically.


## Quick Start

### 1. Get credentials

Log in to the [WP Engine User Portal](https://my.wpengine.com) → **API Access** → **Generate Credentials**. You will see a User ID and API Secret (the secret is shown once — copy it immediately).

When you first ask Claude Code to deploy, it will prompt you for these values and write the `.env` file for you. You do not need to edit any files manually.

### 2. Deploy

Ask Claude Code: _"Deploy my app to WP Engine"_ — it will handle the rest: checking credentials, creating the app and environment if needed, packaging, and deploying. It will only ask you when a genuine decision is needed (such as choosing a WordPress install when multiple options are available).

## Available Commands (`wpe-direct`)

```
wpe-direct status                        # check credentials, envs, and first wpInstall (run this first)
wpe-direct list                          # list environments
wpe-direct list-installs                 # list WordPress installs available as wpInstall
wpe-direct deploy <zip> <env>            # deploy a package
wpe-direct create-env <name> <wpInstall> # create an environment
wpe-direct update-env <name> KEY=VALUE   # set env vars (run after a deploy — see API limitations)
wpe-direct delete-env <name> --confirm   # delete an environment
wpe-direct create-app [appId] [region]   # create a new app
wpe-direct delete-app [appId] --confirm  # delete an app entirely
wpe-direct full [env]                    # build + package + deploy
wpe-direct help
```

> Invoke as: `node skills/wpe-direct/scripts/wpe-direct.js <command>`

### From GitHub Actions

```yaml
- uses: wpengine/headless-deployment-skill@<sha>
  with:
    zip: app.zip
    environment: production
  env:
    WPE_USER_ID: ${{ secrets.WPE_USER_ID }}
    WPE_API_SECRET: ${{ secrets.WPE_API_SECRET }}
    WPE_ACCOUNT: ${{ secrets.WPE_ACCOUNT }}
    WPE_APP_ID: ${{ secrets.WPE_APP_ID }}
```

## Requirements

| Tool | Required by | Notes |
|------|------------|-------|
| `node` (v18+) | wpe-direct, your project build | https://nodejs.org — the only install needed |
| `zip` | wpe-package, wpe-next | Ships with macOS and most Linux distros |

## API

- **Base URL:** `https://js.wpengineapi.com/v1`
- **Upload URL:** `https://js.wpengineapi.com/fu/v1`
- **Auth:** HTTP Basic Auth
- **Reference:** [developers.wpengine.com/docs/headless-platform/reference/api/endpoints/](https://developers.wpengine.com/docs/headless-platform/reference/api/endpoints/)

## Security

- Scripts fail immediately if any required env var is unset.
- No credentials are logged or stored by the scripts.
- Credentials are transmitted over HTTPS only.
- Never commit credentials to version control.
