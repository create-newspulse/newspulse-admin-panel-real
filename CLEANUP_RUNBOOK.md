Cleanup runbook — remove secrets from Git history

Important: This runbook will rewrite Git history. Coordinate with any collaborators before force-pushing the cleaned repo. Back up your repo before starting.

Overview
- We'll create a mirror clone, run git-filter-repo to remove files and blobs containing private keys and service account JSONs, garbage collect, and provide the push command (you must force-push).
- This runbook uses git-filter-repo (recommended). If you prefer BFG, tell me and I'll produce alternate commands.

Files/Patterns we will remove
- admin-backend/**/serviceAccountKey.json
- admin-backend/**/config/*.json
- admin-backend/serviceAccountKey.json
- admin-backend/backend/serviceAccountKey.json
- config/drive-key.json
- admin-backend/.env
- any file containing the strings: "-----BEGIN PRIVATE KEY-----" or "private_key"

Pre-flight checks
1. Make sure you have a local backup of the repository (clone or archive).
2. Install git-filter-repo (https://github.com/newren/git-filter-repo). On Windows you can use:
   pip install git-filter-repo

Mirror clone
```powershell
cd C:\some\safe\folder
# mirror clone to operate on a bare repo
git clone --mirror https://github.com/create-newspulse/newspulse-admin-panel-real.git
cd newspulse-admin-panel-real.git
```

Run git-filter-repo (two passes)
1) Remove by path globs (serviceAccountKey and drive-key JSONs):
```powershell
git filter-repo --invert-paths --path-glob 'admin-backend/**/serviceAccountKey.json' --path-glob 'admin-backend/**/config/*.json' --path-glob 'config/drive-key.json' --path-glob 'admin-backend/.env'
```

2) Remove blobs containing PRIVATE KEY (additional safety):
Create a file `remove_private_key_patterns.txt` with a single line:
```
-----BEGIN PRIVATE KEY-----
```
Then run:
```powershell
git filter-repo --replace-text remove_private_key_patterns.txt
```
This will replace matching text in blobs with empty strings. Confirm the replacements carefully in the repo before pushing.

Finish and push (force)
```powershell
# optional cleanup
git reflog expire --expire=now --all
git gc --prune=now --aggressive
# Carefully inspect the repo now
# Then force-push the cleaned history (this rewrites history)
git push --force --all
git push --force --tags
```

Post-cleanup steps
1. Inform collaborators: they will need to reclone the repository (history was rewritten).
2. Rotate all keys that were exposed (create new service account keys and API keys) and deploy them to your hosts as environment variables (FIREBASE_CREDENTIAL_BASE64 etc.).
3. Verify production and staging systems still work.
4. Remove any local copies of the old keys.

If you want, I can produce an equivalent BFG script. I can also generate a PowerShell script that automates these commands for you (it will not push unless you confirm).