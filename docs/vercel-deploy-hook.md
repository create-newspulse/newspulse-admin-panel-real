# Vercel Deploy Hook CI

This repository includes a GitHub Actions workflow that triggers a Vercel deployment via a deploy hook.

## One-time setup

1. In GitHub, go to: Settings → Secrets and variables → Actions
2. Click "New repository secret" and add:
   - Name: `VERCEL_DEPLOY_HOOK_URL`
   - Value: Paste the deploy hook URL from your Vercel project (Project Settings → Git → Deploy Hooks)

   Alternatively, you can add it as a Repository Variable, but secrets are preferred.

## How to run

- Automatic: Any push to `main` will trigger the workflow.
- Manual: Run the workflow from the Actions tab → "Vercel Deploy Hook" → "Run workflow".

## What you should see

- Step "Resolve hook URL" should report whether it found the URL in secrets or vars (masked).
- Step "Verify secret presence" confirms the URL looks valid.
- Step "Trigger Vercel deploy hook" prints the response from Vercel or notes an empty body if accepted silently.

## Troubleshooting

- Missing secret/var: Add `VERCEL_DEPLOY_HOOK_URL` as described above.
- 401/403: Ensure the deploy hook URL is correct and belongs to the right Vercel project.
- Rate-limits or no body: The workflow retries 3 times; transient issues often resolve automatically.

---

Deploy trigger: 2025-11-02T00:00:00.000Z
