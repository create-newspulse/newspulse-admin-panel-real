# Pre-Commit and Secret Scanning

News Pulse Admin Panel includes repository safeguards intended to reduce accidental secret commits.

## Current Protection Files

The repository currently contains:

- `.husky/pre-commit`
- `.gitleaks.toml`
- `.secret-scan-allowlist`
- `.github/workflows/secret-scan-gitleaks.yml`
- `.github/workflows/secret-scan-windows.yml`
- `scripts/test-hook.ps1`

Keep the allowlist narrow. Prefer removing or masking sensitive content rather than bypassing secret scanning.

## Local Hook Test Harness

`scripts/test-hook.ps1` is a legacy/local test harness.

At present it references:

`.git/hooks/pre-commit.ps1`

That file is not guaranteed to exist in a normal checkout, so the harness must not currently be treated as proof that the active pre-commit hook passed.

Before relying on this harness, verify or update its implementation against the current Husky hook setup.

## Current Source of Truth

For active commit protection, inspect:

- `.husky/pre-commit`
- current Git hook configuration
- current GitHub secret-scan workflows

Do not rely on historical hook documentation when it conflicts with these files.

## Security Rule

Never disable secret scanning simply to make a commit succeed.

If a secret scanner reports a real credential, token, password, private key, or other sensitive value:

1. remove it from tracked content
2. rotate the credential when appropriate
3. use environment variables or secret storage
4. only add a narrowly targeted allowlist rule for verified false positives
