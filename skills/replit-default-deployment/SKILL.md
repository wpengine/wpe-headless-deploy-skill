---
name: replit-default-deployment
description: When running inside Replit, keep Replit Autoscale as the default deployment target unless the user explicitly requests another platform or deployment type.
---

# Replit Default Deployment

Use this skill only when the current session is running inside Replit and the
user has not explicitly chosen an external platform.

## Deployment target resolution gate

Before creating an artifact, choosing a runtime, configuring a workflow, or
starting implementation for a request that includes "deploy", determine the
deployment target.

- If the user names a platform, that platform is authoritative.
- If the user names no platform, do not silently assume Replit when the
  runtime, framework, or wording could indicate an external target.
- Ask one concise question before scaffolding:
  "Where should I deploy this: Replit or another platform?"
- Do not create resources or select a production runtime until the target is
  resolved.
- A requested language is not evidence of platform compatibility. Validate the
  complete production runtime against the selected platform.

## Activation gate

Enable this skill only when Replit context is explicit, or when the current
process environment contains a Replit runtime signal such as `REPL_ID`,
`REPLIT_DEV_DOMAIN`, or `REPLIT_DOMAINS`.

Do not treat the presence of `.replit`, `replit.md`, a pnpm workspace, or this
skill folder as proof that the session is running inside Replit. Those files
can exist in a repository cloned to a local machine.

If the session is ambiguous or appears to be running on a local machine,
assume local-machine behavior: do not apply the Replit Autoscale default, do
not invoke Replit Publish, and do not make Replit-specific deployment changes
unless the user explicitly asks for them.

## Default policy

- Treat Replit Autoscale as the default deployment target only after the
  activation gate passes and the deployment target has been resolved.
- Preserve this root configuration:

```toml
[deployment]
deploymentTarget = "autoscale"
```

- Do not switch to WP Engine, Atlas, Static Deployment, or another target
  without an explicit user request.
- Do not describe an external deployment as the result of Replit Publish.

## Build guidance

- Keep the app compatible with the Replit-managed workflow and preview.
- Use the artifact's existing build command and production configuration.
- For a client-side-only site, Static Deployment may be appropriate when the
  artifact configuration explicitly uses `serve = "static"`.
- Before publishing, verify the relevant workflow is running and the production
  build succeeds.

## External deployment requests

If the user explicitly requests WP Engine Headless or Atlas, stop treating
Replit as the deployment destination and use the repository's `wpe-direct`,
`wpe-package`, or `wpe-next` skill as appropriate. When running locally,
follow the explicitly selected local or external deployment workflow instead.

Never create a Replit artifact as an implementation shortcut before resolving
an explicitly or implicitly requested external deployment target.
