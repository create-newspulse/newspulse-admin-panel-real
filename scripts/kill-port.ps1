<#
 .SYNOPSIS
  Kills any process listening on a given TCP port (Windows PowerShell 5.1+).

 .DESCRIPTION
  Tries Get-NetTCPConnection first (fast, requires NetTCPIP module), then
  falls back to parsing netstat -ano. Designed to be analyzer-friendly and
  safe with -WhatIf/-Confirm via ShouldProcess.

 .PARAMETER Port
  TCP port to free. Defaults to 5173 (Vite dev).

 .EXAMPLE
  ./kill-port.ps1 -Port 5000 -Verbose
#>

[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
Param(
  [Parameter(Mandatory = $false, Position = 0)]
  [ValidateRange(1,65535)]
  [int]$Port = 5173
)

Write-Verbose "Checking for listeners on TCP port $Port"

function Get-PidsByPort {
  param([int]$Port)
  $pids = @()
  try {
    # Prefer NetTCPIP if available
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
      $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
      if ($conns) {
        $pids += ($conns | Select-Object -ExpandProperty OwningProcess -Unique)
      }
    }
  } catch {
    Write-Verbose "Get-NetTCPConnection lookup failed: $($_.Exception.Message)"
  }
  if (-not $pids -or $pids.Count -eq 0) {
    # Fallback: netstat (works without admin)
    try {
      $needle = (':' + $Port + ' ')
      $net = netstat -ano -p tcp | Select-String -SimpleMatch $needle
      if ($net) {
        foreach ($line in $net) {
          $text = $line.ToString()
          $parts = $text -split "\s+" | Where-Object { $_ -ne '' }
          $pidRaw = $parts[-1]
          if ($pidRaw -match '^\d+$') { $pids += [int]$pidRaw }
        }
      }
    } catch {
      Write-Verbose "netstat parsing failed: $($_.Exception.Message)"
    }
  }
  return ($pids | Sort-Object -Unique)
}

$targets = Get-PidsByPort -Port $Port
if (-not $targets -or $targets.Count -eq 0) {
  Write-Output "No process is currently listening on port $Port."
  return
}

foreach ($procId in $targets) {
  try {
    if ($PSCmdlet.ShouldProcess("PID $procId", "Stop-Process -Force")) {
      Stop-Process -Id $procId -Force -ErrorAction Stop
      Write-Output "Killed PID $procId listening on port $Port."
    }
  } catch {
    Write-Warning ("Failed to kill PID {0}: {1}" -f $procId, $_.Exception.Message)
  }
}

Start-Sleep -Milliseconds 250

# Re-check
$remaining = Get-PidsByPort -Port $Port
if (-not $remaining -or $remaining.Count -eq 0) {
  Write-Output "Port $Port is now free."
} else {
  Write-Warning ("Some processes still hold port {0}: {1}" -f $Port, ($remaining -join ', '))
}
