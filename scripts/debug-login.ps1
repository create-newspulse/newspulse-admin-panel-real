<#
.SYNOPSIS
  Quick diagnostic script to test admin login endpoint.
.DESCRIPTION
  Sends a POST to /api/admin/login using env-provided credentials or explicit overrides.
.PARAMETERS
  -Email <string>           Email to use (defaults to FOUNDER/ADMIN env vars)
  -Password <SecureString>  Secure password (fallback to env vars if omitted)
  -ApiBase <string>         Base URL (default http://localhost:5000)
.EXAMPLE
  ./debug-login.ps1 -Email admin@newspulse.ai -Password (Read-Host -AsSecureString)
  ./debug-login.ps1   # uses env vars
#>
param(
  [string]$Email = $env:FOUNDER_EMAIL,
  [System.Security.SecureString]$Password = $null,
  [string]$ApiBase = 'http://localhost:5000'
)

# Resolve Email fallback chain
if (-not $Email) { $Email = $env:ADMIN_EMAIL }

# Extract plain password from secure string OR env variables
$PlainPassword = $null
if ($Password) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
  try { $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
} else {
  $PlainPassword = $env:FOUNDER_PASSWORD
  if (-not $PlainPassword) { $PlainPassword = $env:ADMIN_PASS }
  if (-not $PlainPassword) { $PlainPassword = $env:ADMIN_PASSWORD }
}

Write-Host "[debug-login] Using Email=$Email PasswordLength=$($PlainPassword.Length) ApiBase=$ApiBase" -ForegroundColor Cyan
if (-not $Email -or -not $PlainPassword) { Write-Error 'Missing email or password (env not set and no params provided).'; exit 1 }

$Body = @{ email = $Email; password = $PlainPassword } | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/admin/login" -ContentType 'application/json' -Body $Body -TimeoutSec 20
  Write-Host "[debug-login] Response Success=$($resp.success) Message=$($resp.message)" -ForegroundColor Green
  if ($resp.token) { Write-Host "Token (truncated): $($resp.token.Substring(0,25))..." -ForegroundColor Yellow }
  $resp | ConvertTo-Json -Depth 5 | Out-File -FilePath "debug-login-response.json" -Encoding UTF8
  Write-Host "Full response saved to debug-login-response.json" -ForegroundColor DarkGray
} catch {
  Write-Error "Login request failed: $($_.Exception.Message)"
  if ($_.Exception.Response) {
    try { $_.Exception.Response.Content | Write-Host } catch {}
  }
}
