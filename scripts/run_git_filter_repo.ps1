# PowerShell helper to run git-filter-repo on a mirror clone
# WARNING: This script rewrites history in the mirrored repo. It will not push changes.

param(
  [string]$mirrorRepoPath = "C:\some\safe\folder\newspulse-admin-panel-real.git"
)

if (-not (Test-Path $mirrorRepoPath)) {
  Write-Error "Mirror repo path not found: $mirrorRepoPath"
  exit 1
}

Set-Location $mirrorRepoPath

Write-Host "Running git-filter-repo pass 1: remove paths..."
git filter-repo --invert-paths --path-glob 'admin-backend/**/serviceAccountKey.json' --path-glob 'admin-backend/**/config/*.json' --path-glob 'config/drive-key.json' --path-glob 'admin-backend/.env'

Write-Host "Creating remove_private_key_patterns.txt..."
"-----BEGIN PRIVATE KEY-----" | Out-File -FilePath remove_private_key_patterns.txt -Encoding ascii

Write-Host "Running git-filter-repo pass 2: replace private key blobs..."
git filter-repo --replace-text remove_private_key_patterns.txt

Write-Host "Expiring reflog and garbage collecting..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host "Done. Inspect repository in $mirrorRepoPath. When ready, push with: git push --force --all and git push --force --tags"
