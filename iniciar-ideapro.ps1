$ErrorActionPreference = 'Stop'
$raiz = $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker Desktop no esta instalado o no esta disponible en el PATH. Instala Docker Desktop y vuelve a ejecutar este script.'
}

$compose = Join-Path $raiz 'docker-compose.n8n.yml'
docker compose -f $compose up -d
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo iniciar n8n con Docker Compose. Revisa Docker Desktop y los logs antes de iniciar el backend.'
}

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$raiz\backend'; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$raiz\frontend'; npm run dev"

Write-Host 'n8n:      http://localhost:5678'
Write-Host 'Backend:  http://localhost:3001'
Write-Host 'Frontend: http://localhost:5173'
