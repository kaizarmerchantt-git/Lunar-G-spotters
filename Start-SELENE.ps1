$ErrorActionPreference = 'Stop'
$seleneNodeCommand = Get-Command node -ErrorAction SilentlyContinue
$seleneNodePath = if ($seleneNodeCommand) { $seleneNodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' }
if (-not (Test-Path -LiteralPath $seleneNodePath -PathType Leaf)) {
    throw 'Node.js was not found. Use the existing Codex runtime or install Node.js from its official source before running this preview.'
}
Push-Location -LiteralPath $PSScriptRoot
try {
    Write-Host 'SELENE local data edition. Open http://127.0.0.1:4173/ . Stop with Ctrl+C.'
    & $seleneNodePath (Join-Path $PSScriptRoot 'server\server.cjs')
} finally {
    Pop-Location
}
