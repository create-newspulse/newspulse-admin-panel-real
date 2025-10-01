<#
Simple test harness for the pre-commit hook.
Creates fixtures in a temp folder, sets $stagedFiles to them, and dot-sources the hook script.
This avoids making real git commits and demonstrates detection/allowlist behavior.
#>
param()

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path "$root\.."
$tmp = Join-Path $repo 'tmp-hook-test'
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
New-Item -ItemType Directory -Path $tmp | Out-Null

# Fixture: normal file (should pass)
$f1 = Join-Path $tmp 'normal.txt'
Set-Content -Path $f1 -Value 'hello world'

# Fixture: file with fake secret (should be detected)
# Construct fake key at runtime to avoid storing an obvious literal in the repo file
$f2 = Join-Path $tmp 'secret.txt'
$fakePrefix = 'sk-'
$fakeBody = [System.Guid]::NewGuid().ToString('N').Substring(0,32)
Set-Content -Path $f2 -Value ("api_key = \"" + $fakePrefix + $fakeBody + "\"")

# Fixture: allowed path example (should be skipped)
$allowedDir = Join-Path $repo 'public'
if (-not (Test-Path $allowedDir)) { New-Item -ItemType Directory -Path $allowedDir | Out-Null }
$f3 = Join-Path $allowedDir 'sample.env'
Set-Content -Path $f3 -Value 'API_KEY=publicvalue'

# Prepare $stagedFiles as relative paths
$stagedFiles = @()
$repoPath = (Resolve-Path $repo).Path.TrimEnd('\')
$p1 = (Resolve-Path $f1).Path
$p2 = (Resolve-Path $f2).Path
$p3 = (Resolve-Path $f3).Path
$stagedFiles += $p1.Substring($repoPath.Length + 1)
$stagedFiles += $p2.Substring($repoPath.Length + 1)
$stagedFiles += $p3.Substring($repoPath.Length + 1)

# Dot-source the hook (it expects $stagedFiles variable)
. "$repo\.git\hooks\pre-commit.ps1"

Write-Host "Test run complete. Clean up recommended: Remove $tmp and public/sample.env if created during test." -ForegroundColor Cyan
