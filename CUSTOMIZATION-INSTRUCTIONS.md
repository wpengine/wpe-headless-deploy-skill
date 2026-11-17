# Customization → Instructions (copy-paste)

Paste the block below into your Claude / Replit / IDE **Customization →
Instructions** field. It is self-contained — it enforces WP Engine Headless
compatibility rules without requiring the skill files to be installed.

Use this when you want the compatibility guardrails active in a session that
does not have the `wpe-direct` / `wpe-package` / `wpe-next` skill files
installed locally (or as a belt-and-braces layer on top of them).

---

```
# WP Engine Headless — Build & Deploy Guardrails

When building or deploying an application intended for WP Engine Headless
(Atlas), follow these rules. They apply to new apps and to existing apps
being redeployed.

## 1. Supported runtime contract

Application code must run entirely in Node.js **or** compile to static
browser assets. Only these production runtimes are supported:

- Node.js application code
- Browser/static assets
- Dependencies installed through package.json / lockfile
- WP Engine-supported framework adapters (Next.js, Nuxt, Remix, Gatsby,
  Astro, SvelteKit, SolidStart, QwikCity, Faust.js, or any Node.js adapter)

## 2. Runtime allowlist — hard rules

Before packaging or deploying, search production code and scripts for
subprocess execution through child_process, exec, execFile, spawn, shell
scripts, or equivalent APIs.

REJECT the deployment when these calls require an external runtime or
executable not on the allowlist. Examples that must be rejected:

- perl, python, ruby, php, java, go, rust
- Locally installed CLIs (ffmpeg, imagemagick, pandoc, etc.)
- Arbitrary system binaries or OS packages (apt, brew, nix)
- Writable local persistence (SQLite files, on-disk state)
- Replit-, Vercel-, or Netlify-specific runtime services

The presence of an executable during local testing does NOT establish
platform support. Dev environments ship binaries WP Engine does not
officially support. A local smoke test proves the local environment works;
it does not prove WP Engine will.

## 3. Gate runs before every WP Engine resource action

Run the checks in (1) and (2) **before every one of**: create-app,
create-env, packaging, deploy, and any redeploy. Do not skip on
redeployment. Do not infer compatibility from a previous successful build.

## 4. If the gate fails — STOP

Do not create-app, create-env, package, or upload. Explain the exact
incompatibility to the user and offer compatible alternatives:

- Rewrite the offending runtime in Node.js.
- Deploy the unsupported backend to a compatible external service and call
  it over HTTPS from the Node.js app.
- Choose another hosting platform.

Do not create or update WP Engine resources while waiting for the user's
decision.

## 5. Server contract

Every SSR/ISR/Node server must:

- Bind to 0.0.0.0
- Read process.env.PORT
- Start without a development harness (no `next dev`, no `vite`, no watch
  mode in production)
- Have no dependency on host-specific env vars (REPL_*, VERCEL_*, etc.)

## 6. Custom static wrappers

If you generate an Express/Node wrapper for a static build, it may only
serve static output, provide SPA fallback routing, and expose simple Node.js
routes implemented entirely in the packaged application. It must NOT import
child_process, launch external executables, or require files outside the
static build and declared package.json dependencies.

## 7. Package the production closure only

Build the deployment from an allowlist, not by copying the repository or
workspace root.

Static/SPA deployment includes only:
- Compiled frontend output
- Minimal production server.js
- Minimal production package.json
- Lockfile when required
- .wpengine.yaml

Source deployment includes only:
- Source files, config, assets
- Workspace packages actually imported by production entry points

Exclude unrelated lib/ packages, database libraries, generated API clients,
schema packages, test utilities, mocks, scripts, examples, and any file not
reachable from the production entry points.

## 8. Scaffolding hygiene

When creating a new WP Engine-targeted application, prefer a single
deployable application package. Do not scaffold workspace libraries
(lib/db, generated API clients, shared utilities) unless the application
actually imports them.

Before delivery, run an unused-file and dependency review. Remove
scaffolded libraries and dependencies not reachable from the application's
production entry points.

## 9. Framework rejection is not the answer

Nuxt, Remix, Gatsby, Astro, SvelteKit, SolidStart, QwikCity, and Faust.js
are all supported when paired with a valid Node.js adapter. Confirm the
adapter, build/start commands, and port behavior — do NOT reject the
framework outright.

## 10. Communicate incompatibility early

If the user asks for a WP Engine deployment of a project that already
contains disallowed code (subprocess calls, external CLIs, host-specific
services), raise the incompatibility BEFORE creating any WP Engine
resource. Do not create the app record and postpone the compatibility
decision until upload.
```
