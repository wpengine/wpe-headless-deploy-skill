---
name: wpe-next
description: Package and deploy a Next.js app to WP Engine Headless — SSR, App Router, and API routes are fully supported. Packages source files, WP Engine runs npm install + next build + next start. Use for any Next.js application on WP Engine, Atlas, or WP Engine Headless.
version: 2.0.0
---

# WP Engine Headless — Next.js Skill

Packages a Next.js source project into the zip structure the WP Engine Headless direct upload API requires. WP Engine handles `npm install`, `next build`, and `next start` — you upload the source code.

## Run the compatibility gate first

Before scaffolding, packaging, `create-app`, `create-env`, or deploy, run the
**WP Engine compatibility gate** in `../wpe-direct/SKILL.md`. The gate applies
to every deploy and redeploy, not only the first `create-app`. In particular:

- API routes and server code must run entirely in Node.js — no shell-outs to
  perl, python, ruby, php, ffmpeg, or other external executables.
- No dependency on host-specific runtime services (Replit, Vercel, Netlify
  serverless-only APIs).

If any check fails, **stop before touching WP Engine resources** and offer
compatible alternatives.

## Production dependency closure

Package only files reachable from Next.js production entry points:

- App/pages routes, `app/`, `pages/`, `public/`, config files
- `package.json`, lockfile, `.wpengine.yaml`, framework config files
- Workspace packages **only if imported** by production code

Exclude unrelated `lib/` packages, generated API clients, schema packages,
scripts, examples, test utilities, and any workspace library the production
code does not import. When creating a new WP Engine-targeted app, prefer a
single deployable application — do not add scaffolded libraries you have not
yet wired in.

## Available scripts

- **`scripts/wpe-next.js <app-name> [output-dir]`** — creates the deployment zip

```bash
node scripts/wpe-next.js my-app .
# produces: ./my-app.zip
```

Arguments:
| Argument | Default | Description |
|---|---|---|
| `app-name` | `app` | Used as the zip folder name and output filename |
| `output-dir` | `.` | Where to write the zip |

## Workflow

When asked to deploy a Next.js app to WP Engine, run the following as a **single guided operation**. The user should only be prompted when a genuine decision is needed.

**Step 0 — Credentials first, before anything else.**

Open `.env` and verify it exists **and** that all four variables have non-empty values:

```
WPE_USER_ID, WPE_API_SECRET, WPE_ACCOUNT, WPE_APP_ID
```

An empty file, a file with blank values, or a missing file all count as unconfigured. If any value is missing or empty, follow the Credentials section in `../wpe-direct/SKILL.md` to collect them conversationally and write the file. Do not proceed to any other step until all four variables have real values. Prior memory about a previous deployment does not mean credentials are still valid — always read the file and verify.

**Step 1 — Scaffold if needed.**

Look for a `package.json` with `"next"` in dependencies.

- If found: proceed to Step 2.
- If not found, determine the app name before scaffolding:
  1. `WPE_APP_ID` is already confirmed set from Step 0 — use it as `<app-name>`.
  2. Ask whether they prefer JavaScript or TypeScript (default: JavaScript).
  3. Scaffold:
     ```bash
     npx create-next-app@latest <app-name> \
       --js --app --no-tailwind --no-eslint \
       --no-src-dir --no-import-alias
     cd <app-name>
     ```
     Use `--ts` instead of `--js` for TypeScript. Do **not** add `output: 'standalone'`.

**Step 2 — Verify the local build.**

```bash
npm run build
```

Fix any build errors before continuing. If the build fails, explain the error in plain language and help the user fix it — do not proceed with a broken build.

**Step 3 — Package.**

```bash
node scripts/wpe-next.js <app-name> .
# produces: ./<app-name>.zip
```

**Step 4 — Deploy.**

Hand off to the `wpe-direct` skill. Read `../wpe-direct/SKILL.md` and follow its deployment workflow from Step 2 onward (status check → create app/env if needed → deploy → report live URL), passing the zip produced in Step 3.

## Gotchas

- **Do not use `output: 'standalone'`.** The script exits if it detects this — source deployment is incompatible with standalone mode.
- **`node_modules` and `.next` are excluded from the zip.** WP Engine installs dependencies and builds from source on its end.
- **`.env` files are excluded.** Set secrets through WP Engine's environment variable settings, not the zip.
- **`next start` reads `process.env.PORT` automatically** (Next.js 13.4+). No custom server wrapper is needed.
- **The zip must have a single top-level folder named after the app.** The script enforces this.

## Error handling

When the packaging script fails, translate the error before relaying it:

| Script error | Plain-language explanation |
|---|---|
| `output: 'standalone' detected` | "Your Next.js config has standalone mode enabled. Remove `output: 'standalone'` from `next.config.*` and try again." |
| `no 'build' script found` | "Your `package.json` doesn't have a `build` script. Add `\"build\": \"next build\"` and try again." |
| `no 'start' script found` | "Your `package.json` doesn't have a `start` script. Add `\"start\": \"next start\"` and try again." |
| `package.json not found` or missing `next` dep | "No Next.js project found in this directory. Make sure you're in the project folder." |

## Limitations

- **No SSR edge runtime support.** WP Engine Headless runs Node.js containers — `runtime: 'edge'` in route handlers is not supported.
- **ISR requires a Node-compatible route/runtime.** Atlas supports ISR, but
  edge-only handlers and host-specific revalidation services (Replit, Vercel,
  Netlify, etc.) are not supported by this source deployment path. Validate
  revalidation behavior in a production start smoke test.
- **Static export (`output: 'export'`) is not supported.** Use the `wpe-package` skill for static HTML output instead.
