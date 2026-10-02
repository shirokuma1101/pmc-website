$ErrorActionPreference = "Stop"
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pmc-map-storage-" + [Guid]::NewGuid().ToString("N"))
$archiveRoot = Join-Path $testRoot "archives"
$outputRoot = Join-Path $testRoot "NAS output"
$global:PmcMapStorageTestState = @{ RequireNfs = "false"; ConfigFail = $false; Runs = 0; OutputRoot = $outputRoot }

function docker {
  if ($args -contains "config") {
    $global:LASTEXITCODE = [int]$global:PmcMapStorageTestState.ConfigFail
    if ($global:PmcMapStorageTestState.ConfigFail) { return }
    @{
      services = @{
        "map-generator" = @{
          volumes = @(@{ source = $global:PmcMapStorageTestState.OutputRoot; target = "/output" })
          environment = @{ MAP_REQUIRE_NFS = $global:PmcMapStorageTestState.RequireNfs }
        }
      }
    } | ConvertTo-Json -Depth 8
  } else {
    $global:PmcMapStorageTestState.Runs++
    $global:LASTEXITCODE = 0
  }
}

try {
  New-Item -ItemType Directory -Path $archiveRoot, $outputRoot | Out-Null
  $archive = New-Item -ItemType File -Path (Join-Path $archiveRoot "world.tar.gz")
  $archive.LastWriteTime = [DateTime]::new(2026, 9, 1, 12, 0, 0)
  $snapshotId = ([DateTimeOffset]$archive.LastWriteTime).ToString("yyyyMMddTHHmmss")
  @{ version = 1; worlds = @(@{ id = "storage-test"; snapshots = @(@{ id = $snapshotId }) }) } |
    ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $outputRoot "catalog.json")
  $historyScript = Join-Path $PSScriptRoot "../generate-history.ps1"
  & $historyScript -ArchiveDirectory $archiveRoot -WorldId "storage-test"
  if ($global:PmcMapStorageTestState.Runs -ne 0) { throw "Configured external catalog was not used" }
  Write-Host "PASS: PowerShell uses configured external catalog"

  foreach ($scenario in @("nfs", "config-failure", "invalid-setting")) {
    $global:PmcMapStorageTestState.RequireNfs = if ($scenario -eq "nfs") { "true" } elseif ($scenario -eq "invalid-setting") { "invalid" } else { "false" }
    $global:PmcMapStorageTestState.ConfigFail = $scenario -eq "config-failure"
    $rejected = $false
    try { & $historyScript -ArchiveDirectory $archiveRoot -WorldId "storage-test" }
    catch { $rejected = $true }
    if (-not $rejected -or $global:PmcMapStorageTestState.Runs -ne 0) { throw "Unsafe configuration accepted: $scenario" }
  }
  Write-Host "PASS: PowerShell rejects NFS-only, invalid and failed configurations"
} finally {
  Remove-Variable -Name PmcMapStorageTestState -Scope Global
  $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
  $tempPrefix = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolvedTestRoot.StartsWith($tempPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe test cleanup path: $resolvedTestRoot"
  }
  if (Test-Path -LiteralPath $resolvedTestRoot) { Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force }
}
