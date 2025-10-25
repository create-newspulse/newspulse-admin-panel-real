Secrets report (auto-generated)

Found sensitive files (examples):
- admin-backend/serviceAccountKey.json
- admin-backend/backend/serviceAccountKey.json
- admin-backend/config/serviceAccountKey.json
- admin-backend/config/news-pulse-gemini-key.json
- admin-backend/backend/serviceAccountKey.json
- config/drive-key.json
- admin-backend/.env (contains API keys)

Immediate recommended actions:
1. Rotate the exposed keys (create new service account keys and API keys). Deploy new keys to your hosts as env vars.
2. Remove the old keys from Google Cloud / Firebase console.
3. Run the `scripts/run_git_filter_repo.ps1` workflow on a mirror clone (it will not push) and review results.
4. When satisfied, push the cleaned history with `git push --force --all` and `git push --force --tags`.

If you want me to prepare the git-filter-repo run and provide the exact push commands, say "Run cleanup" and confirm you understand force-pushing rewrites history.
