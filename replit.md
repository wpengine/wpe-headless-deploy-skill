## Deployment defaults

- When working inside Replit, Autoscale is the default deployment target,
  configured in `.replit`.
- This Replit-specific default is active only when the session has explicit
  Replit context or a Replit runtime signal such as `REPL_ID`,
  `REPLIT_DEV_DOMAIN`, or `REPLIT_DOMAINS`.
- When the repository is used on a local machine, do not assume Replit
  deployment or invoke Replit Publish.
- Use WP Engine Headless only when the user explicitly requests external deployment.
- A project-local Agent skill can guide build and deployment behavior, but the
  `.replit` deployment configuration controls Replit publishing.

## WP Engine Headless application target (Replit-specific reminders)

The universal WP Engine application-creation contract lives in `CLAUDE.md`
and `skills/wpe-direct/SKILL.md`. Follow that contract whenever WP Engine /
Atlas is the selected target. This section only lists the Replit-specific
concerns to check on top of it:

- Do not carry Replit-injected env vars, secrets, or `REPLIT_*` runtime
  signals into the WP Engine deployment package.
- Do not rely on Replit's dev proxy for the production server — the app must
  bind to `0.0.0.0`, read `PORT`, and start without Replit's workflow harness.
- Replit's built-in databases, object storage, and auth services are not
  available on Atlas — swap them for portable equivalents before scaffolding
  for WP Engine.
- Run the local production build and start smoke test from a plain shell,
  not through Replit's Run button, to catch any hidden dependency on the
  Replit environment.
