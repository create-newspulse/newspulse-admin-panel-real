param(
  [string]$BaseUrl = $env:ADMIN_BACKEND_URL
)

if (-not $BaseUrl) { $BaseUrl = 'https://your-backend-host.tld' }

function Invoke-Json {
  param(
    [Parameter(Mandatory=$true)][string]$Uri,
    [hashtable]$Headers
  )
  try {
    $res = Invoke-RestMethod -Method Get -Uri $Uri -Headers $Headers -TimeoutSec 40
    Write-Host "200 $Uri"
    $res | ConvertTo-Json -Depth 6
  } catch {
    try { $code = $_.Exception.Response.StatusCode.Value__ } catch { $code = "ERR" }
    Write-Host "$code $Uri"
  }
}

Write-Host "=== Checking $BaseUrl ==="
Invoke-Json "$BaseUrl/api/health" @{}
Invoke-Json "$BaseUrl/api/system/ai-training-info" @{}
Invoke-Json "$BaseUrl/api/admin-auth/session" @{ Cookie = 'np_admin=admin@newspulse.ai' }
