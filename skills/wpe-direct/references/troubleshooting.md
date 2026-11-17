# Troubleshooting — wpe-direct

Read this file when a script command fails. Match the error to a section below, take the corrective action yourself where possible, and only relay information to the user when their input is required. Never surface raw shell errors, HTTP status codes, or `jq` output directly.

---

## "WPE_USER_ID is required" (or any other required variable)

**What happened:** A required credential is missing — `.env` is absent or incomplete.

**Action:** Follow the Credentials section of SKILL.md. Collect missing values conversationally and write the `.env` file. Do not ask the user to run `export` commands or edit files manually.

---

## "environment 'X' not found"

**What happened:** The environment name passed to the script doesn't match what WP Engine has on record. Names are case-sensitive and must match exactly.

**Action:** Run `node scripts/wpe-direct.js list` to get the exact display name, then retry with the correct spelling. No user input needed.

---

## "file not found: \<zip\>"

**What happened:** The zip path is wrong or the packaging step didn't complete successfully.

**Action:** Confirm the packaging script ran and produced a file. If not, run the packaging step first. No user input needed.

---

## HTTP 401 / Unauthorized

**What happened:** The credentials in `.env` are wrong or have been regenerated since the file was written.

**What to tell the user:** "Your WP Engine API credentials are no longer valid. Please go to my.wpengine.com → API Access → Generate Credentials to get new ones, and paste them here."

**Action:** Update `.env` with the new values the user provides, then retry.

---

## HTTP 403 on `create-env` — "WordPress environments do not exist"

**What happened:** Every WP Engine headless environment must be linked to a WordPress install — this is a platform requirement even for pure Node.js apps. The `<wpInstall>` name passed to `create-env` doesn't match any install in the account.

**Action:** Run `node scripts/wpe-direct.js list-installs` to see what's available.
- If there is exactly one install, use it automatically and retry.
- If there are multiple, show them to the user and ask: _"Which WordPress install should this app be linked to?"_ Then retry `create-env` with the chosen name.

---

## HTTP 403 / Forbidden (general)

**What happened:** The credentials are valid but don't have access to this account or resource.

**What to tell the user:** "Your WP Engine credentials don't have access to this account. Check that your account name is correct — you can find it in the URL after logging in: `my.wpengine.com/accounts/YOUR-ACCOUNT`."

---

## HTTP 409 / Build lock

**What happened:** WP Engine is still processing a previous build. API calls that modify the app (update-env, delete-env, delete-app) are blocked until the build finishes.

**Action:** Wait approximately 30 seconds and retry. Run `node scripts/wpe-direct.js build-status production` to check when the build completes. Do not surface this to the user — just retry silently until the lock clears.

---

## HTTP 400 — App name already taken

**What happened:** App names on WP Engine are permanently reserved once created or deleted. The same name cannot be reused.

**What to tell the user:** "That app name is already taken on WP Engine and can't be reused. Please choose a different name for this app."

**Action:** Ask for a new name, update `WPE_APP_ID` in `.env`, and retry `create-app`.

---

## HTTP 500 on `update-env`

**What happened:** `update-env` was called on an environment that has never been deployed to. WP Engine's internal configuration object doesn't exist yet.

**Action:** Run a deploy first (`node scripts/wpe-direct.js deploy "$WPE_APP_ID.zip" production`), then retry `update-env`. No user input needed.

---

## Upload fails (non-200/201 response)

**What happened:** The zip structure is wrong, the file is too large, or there was a transient network error.

**Action:**
1. Verify the zip is valid: `unzip -t "$WPE_APP_ID.zip"`
2. Confirm the correct nested structure — a flat zip (files at root) is rejected:
   ```
   app-name/
   ├── package.json
   ├── server.js  (or equivalent)
   ├── .wpengine.yaml
   └── build/  (or source files for Next.js)
   ```
3. If the zip is over 100 MB, tell the user: "The deployment package is very large. Check that `node_modules` and build artifacts are excluded."
4. If the structure is wrong, re-run the packaging script.

---

## App not live after deploy

**What happened:** The build completed successfully but the container hasn't started yet. This is normal — it takes 2–5 minutes after `SUCCEEDED` is reported.

**What to tell the user:** "Your app deployed successfully and will be live at [URL] within a few minutes while the container starts up."

If it's still not responding after 10 minutes, check the WP Engine Headless dashboard for build logs. The most common cause is the app's `start` script failing to bind on `process.env.PORT` with host `0.0.0.0`.
