Pre-commit secret scanner
=========================

What it does
------------
- Detects likely secrets (API keys, tokens, PEM blocks, long base64/hex strings) in staged files and blocks commits.
- Skips binary files and files matched by `.secret-scan-allowlist`.

Files
-----
- `.git/hooks/pre-commit.ps1` - PowerShell hook used on Windows (Husky and a small batch wrapper call this).
- `.secret-scan-allowlist` - newline-separated glob patterns to skip (comments start with `#`).
- `scripts/test-hook.ps1` - local test harness that simulates staged files and runs the hook logic without committing.
- `.github/workflows/secret-scan.yml` - CI workflow that runs the test harness and gitleaks on PRs/pushes.

Running locally
---------------
1. To run the test harness without touching Git:

   pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-hook.ps1

2. To test the hook in a real commit flow (will block commits if secrets are detected):

   # create a file with a fake secret, stage, and commit
   echo "api_key = \"sk-...\"" > test-secret.txt
   git add test-secret.txt
   git commit -m "test secret"

Allowlist
---------
- Add globs to `.secret-scan-allowlist` to skip known safe files (examples: `public/sample.env`, `docs/**`).
- Keep allowlist minimal — it's a bypass; prefer to fix or mask secrets instead.

CI
--
- The `secret-scan` GitHub Action runs the `scripts/test-hook.ps1` harness and `gitleaks` on PR and push to `main`.

Notes for maintainers
---------------------
- Patterns are stored in a here-string inside the hook for readability and to avoid tricky escaping.
- If you see false positives, add a targeted allowlist entry or adjust the regex in the hook.
- Consider installing `PSScriptAnalyzer` in your dev environment for consistent linting of hook scripts.
