param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$lock = [System.Threading.Mutex]::new($false, 'Local\RaceAdministrationLauncher')
$locked = $false
function Get-Listener($Port) {
    @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}
function Wait-Page($Url) {
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try {
            $request = [System.Net.HttpWebRequest]::Create($Url)
            $request.Proxy = $null
            $request.Timeout = 2000
            $response = $request.GetResponse()
            $response.Close()
            return
        } catch { Start-Sleep -Milliseconds 500 }
    }
    throw "Service did not become ready: $Url. Check output/local-preview logs."
}
function Check-Owner($Listeners, $ExpectedFile) {
    foreach ($listener in $Listeners) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if ($owner.Name -ne 'node.exe' -or $owner.CommandLine -notlike "*$ExpectedFile*") {
            throw "Port $($listener.LocalPort) is occupied by another program (PID $($listener.OwningProcess))."
        }
    }
}
try {
    $locked = $lock.WaitOne(0)
    if (-not $locked) { Write-Host 'The launcher is already running.'; exit 0 }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $vite = Join-Path $projectRoot 'frontend/node_modules/vite/bin/vite.js'
    if (-not (Test-Path -LiteralPath $vite) -or -not (Test-Path -LiteralPath (Join-Path $projectRoot 'backend/node_modules/express'))) {
        throw 'Dependencies are missing. Run npm --prefix backend ci and npm --prefix frontend ci in the project directory.'
    }
    $physicalIndexes = @(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty ifIndex)
    $addresses = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.InterfaceIndex -in $physicalIndexes -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1'
    } | Select-Object -ExpandProperty IPAddress -Unique)
    $origins = @('http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5000')
    $origins += @($addresses | ForEach-Object { "http://${_}:5173" })
    $logs = Join-Path $projectRoot 'output/local-preview'
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $backendListeners = Get-Listener 5000
    $frontendListeners = Get-Listener 5173
    Check-Owner $backendListeners 'server.js'
    Check-Owner $frontendListeners 'vite'
    if (-not $backendListeners.Count) {
        $oldHost = $env:HOST; $oldPort = $env:PORT; $oldOrigins = $env:APP_ORIGINS
        try {
            $env:HOST = '127.0.0.1'; $env:PORT = '5000'; $env:APP_ORIGINS = $origins -join ','
            Start-Process -FilePath $node -ArgumentList 'server.js' -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "backend-$stamp.stdout.log") -RedirectStandardError (Join-Path $logs "backend-$stamp.stderr.log") | Out-Null
        } finally { $env:HOST = $oldHost; $env:PORT = $oldPort; $env:APP_ORIGINS = $oldOrigins }
    }
    Wait-Page 'http://127.0.0.1:5000/api/v1/health'
    if (-not $frontendListeners.Count) {
        Start-Process -FilePath $node -ArgumentList 'node_modules/vite/bin/vite.js','--host','0.0.0.0' -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs "frontend-$stamp.stdout.log") -RedirectStandardError (Join-Path $logs "frontend-$stamp.stderr.log") | Out-Null
    }
    Wait-Page 'http://127.0.0.1:5173'
    Wait-Page 'http://127.0.0.1:5173/api/v1/health'
    Write-Host 'Ready: http://127.0.0.1:5173'
    foreach ($address in $addresses) { Write-Host "LAN: http://${address}:5173" }
    if ((Get-Listener 5173 | Where-Object LocalAddress -eq '127.0.0.1')) {
        Write-Warning 'The existing frontend only listens locally. Restart it with --host 0.0.0.0 for LAN access.'
    }
    if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
} finally {
    if ($locked) { $lock.ReleaseMutex() }
    $lock.Dispose()
}