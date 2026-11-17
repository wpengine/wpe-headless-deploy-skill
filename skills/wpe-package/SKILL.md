---
name: wpe-package
description: Package a static or SPA site (React, Vue, Svelte) for WP Engine Headless — wraps the build output in an Express server and creates the zip structure required for upload. Use before deploying a static site to WP Engine or Atlas.
version: 2.0.0
---

# WP Engine Headless — Static Site Packaging Skill

Takes the output of a static site build (React, Vue, Svelte, etc.) and wraps it in a minimal
Express server, then zips everything into the nested folder structure the WP Engine Headless
direct upload API requires. This is a packaging step — your site must already be built before
running this skill.

Atlas supports SSR, SSG, and ISR across multiple Node.js frameworks, but this
helper is only the static/SPA packaging path. Do not use it for an SSR or ISR
application; use the framework's Node.js deployment package instead.

## Run the compatibility gate first

Before packaging, run the **WP Engine compatibility gate** in
`../wpe-direct/SKILL.md`. Packaging is a deployment step and the gate is
mandatory before every deploy — not just the first `create-app`.

## Static wrapper restrictions

The generated Express server may only:

- Serve static output from the packaged `build/` directory.
- Provide SPA fallback routing to `index.html`.
- Expose simple Node.js routes implemented **entirely in the packaged Node.js
  application** (no shell-outs).

The wrapper **must not**:

- Import `node:child_process`, `child_process`, or equivalent.
- Call `exec`, `execFile`, `spawn`, or shell scripts.
- Launch external executables (perl, python, ruby, php, ffmpeg, etc.).
- Require files outside the static `build/` directory and the declared Node.js
  `package.json` dependency tree.

If the project needs any of the above, **stop** — do not package it as a
static application. Route the project through the compatibility gate, then
choose a supported alternative (rewrite in Node.js, offload to an external
HTTP service, or pick another host).

## Production dependency closure

Build the deployment from an **allowlist**, not by copying the repository or
workspace root. Include only:

- The compiled frontend output (`build/`)
- The minimal production `server.js` this skill generates
- The minimal production `package.json` this skill generates
- The lockfile if required
- `.wpengine.yaml`

Exclude everything else, including:

- Unrelated `lib/` packages, database libraries, API clients not called from
  the frontend
- Test utilities, mocks, examples, scripts
- Generated files not part of the production dependency graph
- Source repositories outside the compiled frontend build

## Available scripts

- **`scripts/wpe-package.js <app-name> [build-dir]`** — creates the deployment zip

```bash
node scripts/wpe-package.js my-app build .
# produces: ./my-app.zip
```

Arguments:
| Argument | Default | Description |
|---|---|---|
| `app-name` | `app` | Used as the zip folder name and output filename |
| `build-dir` | `build` | Directory containing the compiled output |
| `output-dir` | `.` | Where to write the zip |

## Limitations — SPA/static apps only

The generated `server.js` serves static files and catches all routes to `index.html`.
This is correct for **React, Vue, Svelte, and similar SPA builds**.

It is **not suitable for SSR frameworks** (Next.js, Nuxt, Remix, SvelteKit in SSR mode).
For SSR apps, replace `server.js` and update the `start` script and `.wpengine.yaml` manually
before running the script, or build a custom packager.

## Workflow

- [ ] 1. Confirm the build directory exists (`build/` or `dist/`). If missing, run the project build first.
- [ ] 2. If the output directory is named `dist/`, pass it explicitly — the script copies it as `build/` internally:
  ```bash
  node scripts/wpe-package.js my-app dist .
  ```
- [ ] 3. Run the packaging script:
  ```bash
  node scripts/wpe-package.js my-app build .
  ```
- [ ] 4. Verify the zip structure:
  ```bash
  unzip -l my-app.zip
  ```
  Expected:
  ```
  my-app/package.json
  my-app/server.js
  my-app/.wpengine.yaml
  my-app/build/index.html
  my-app/build/...
  ```
- [ ] 5. Pass `my-app.zip` to `wpe-direct` for deployment.

## Gotchas

- **The zip must have exactly one top-level folder named after the app.** Files at the root level will cause the upload to be rejected.
- **`build/` must be the directory name inside the zip.** The script always copies the source build dir as `build/`. The `.wpengine.yaml` and `server.js` both reference `build/` — do not rename it.
- **The `build` script in `package.json` is a no-op by design.** WP Engine runs `npm run build` before starting the app — the no-op `echo` prevents re-running your build in the deployment environment.
- **The server uses CommonJS (`require`), not ESM (`import`).** Node.js requires an explicit `"type": "module"` in package.json for ESM — the generated file doesn't set this, so don't convert `require` to `import`.
- **The server must listen on `0.0.0.0`, not `localhost`.** Binding to `localhost` only will make the app unreachable in the container environment.
- **If a `server.js` or `package.json` already exists in the current directory**, the script writes to a temp directory and only the final zip lands in the output dir — the originals are not touched.

## What the script generates

### package.json

```json
{
  "name": "<app-name>",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "build": "echo 'Build already completed'"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

### server.js

```javascript
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;
app.use(express.static(path.join(__dirname, 'build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
```

### .wpengine.yaml

```yaml
build:
  command: npm run build
start:
  command: node server.js
nodejs:
  version: 18
port: $PORT
```
