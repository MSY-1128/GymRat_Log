# .env 를 읽어 현재 프로세스 환경변수로 명시 주입한 뒤 Spring Boot를 실행한다.
# 사용: .\scripts\run-backend.ps1   (프로젝트 루트에서)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'

if (-not (Test-Path $envFile)) {
    Write-Error ".env 파일이 없습니다. 먼저 'Copy-Item .env.example .env' 후 값을 수정하세요."
}

$allowed = @('SPRING_DATASOURCE_URL', 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD',
             'SPRING_PROFILES_ACTIVE', 'SERVER_PORT', 'SERVER_ADDRESS', 'MFDS_SERVICE_KEY')
foreach ($line in Get-Content $envFile -Encoding UTF8) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#') -or -not $t.Contains('=')) { continue }
    $idx = $t.IndexOf('=')
    $key = $t.Substring(0, $idx).Trim()
    $val = $t.Substring($idx + 1).Trim().Trim('"').Trim("'")
    if ($allowed -contains $key) { Set-Item -Path "Env:$key" -Value $val }
}

Push-Location (Join-Path $root 'backend')
try {
    & .\mvnw.cmd spring-boot:run
} finally {
    Pop-Location
}
