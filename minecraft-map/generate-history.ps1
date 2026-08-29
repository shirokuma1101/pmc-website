[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ArchiveDirectory,
  [string]$WorldId = "world",
  [string]$WorldLabel = "Minecraft World",
  [ValidateSet("full", "radius")]
  [string]$RenderMode = "full",
  [int]$Radius = 512,
  [int]$CenterX = 0,
  [int]$CenterZ = 0,
  [switch]$ContinueOnError,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$archiveRoot = (Resolve-Path -LiteralPath $ArchiveDirectory).Path
$composeFile = Join-Path $PSScriptRoot "docker-compose.map.yml"
$catalogPath = Join-Path $PSScriptRoot "output\catalog.json"
$archives = @(Get-ChildItem -LiteralPath $archiveRoot -File -Filter "*.tar.gz" | Sort-Object LastWriteTime, Name)

if ($archives.Count -eq 0) {
  throw "No .tar.gz archives were found in $archiveRoot"
}

$existingIds = @{}
if (Test-Path -LiteralPath $catalogPath) {
  $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
  $catalogWorld = $catalog.worlds | Where-Object { $_.id -eq $WorldId } | Select-Object -First 1
  if ($null -ne $catalogWorld) {
    foreach ($snapshot in @($catalogWorld.snapshots)) {
      if ($null -ne $snapshot -and -not [string]::IsNullOrWhiteSpace($snapshot.id)) {
        $existingIds[$snapshot.id] = $true
      }
    }
  }
}

$previousArchiveDirectory = $env:MAP_ARCHIVE_DIRECTORY
$failedArchives = [System.Collections.Generic.List[string]]::new()
try {
  $env:MAP_ARCHIVE_DIRECTORY = $archiveRoot
  foreach ($archive in $archives) {
    $timestamp = [DateTimeOffset]$archive.LastWriteTime
    $snapshotId = $timestamp.ToString("yyyyMMddTHHmmss")
    $snapshotLabel = $timestamp.ToString("yyyy/MM/dd HH:mm")
    $snapshotCreatedAt = $timestamp.ToString("yyyy-MM-ddTHH:mm:sszzz")

    if (-not $Force -and $existingIds.ContainsKey($snapshotId)) {
      Write-Host "[map-history] Skip existing snapshot $snapshotId ($($archive.Name))"
      continue
    }

    Write-Host "[map-history] Generate $WorldId / $snapshotLabel from $($archive.Name)"
    & docker compose -f $composeFile run --rm `
      -e "MAP_ARCHIVE=$($archive.Name)" `
      -e "MAP_WORLD_ID=$WorldId" `
      -e "MAP_WORLD_LABEL=$WorldLabel" `
      -e "MAP_SNAPSHOT_ID=$snapshotId" `
      -e "MAP_SNAPSHOT_LABEL=$snapshotLabel" `
      -e "MAP_SNAPSHOT_CREATED_AT=$snapshotCreatedAt" `
      -e "MAP_RENDER_MODE=$RenderMode" `
      -e "MAP_RENDER_RADIUS=$Radius" `
      -e "MAP_RENDER_CENTER_X=$CenterX" `
      -e "MAP_RENDER_CENTER_Z=$CenterZ" `
      map-generator
    if ($LASTEXITCODE -ne 0) {
      if (-not $ContinueOnError) {
        throw "Map generation failed for $($archive.FullName)"
      }
      $failedArchives.Add($archive.FullName)
      Write-Warning "Skipped invalid or failed backup: $($archive.FullName)"
      continue
    }
    $existingIds[$snapshotId] = $true
  }
} finally {
  $env:MAP_ARCHIVE_DIRECTORY = $previousArchiveDirectory
}

Write-Host "[map-history] Complete. Catalog: $catalogPath"
if ($failedArchives.Count -gt 0) {
  Write-Warning "$($failedArchives.Count) backup(s) failed. Other snapshots were preserved."
  foreach ($failedArchive in $failedArchives) {
    Write-Warning "  $failedArchive"
  }
  exit 1
}
