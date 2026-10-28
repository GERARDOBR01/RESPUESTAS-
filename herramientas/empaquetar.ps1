# Arma dist\raven-llenar-respuestas-v<versión>.zip con solo lo que necesita Chrome
# (sin pruebas, marca ni git) más la guía y la licencia, para entregar al cliente.
# Uso: powershell -ExecutionPolicy Bypass -File herramientas\empaquetar.ps1
$ErrorActionPreference = 'Stop'
$raiz = Split-Path $PSScriptRoot -Parent
# Sin llave pública la extensión no pide licencia: no se entrega así.
if ((Get-Content (Join-Path $raiz 'licencia.js') -Raw -Encoding UTF8) -match 'const LICENCIA_PUBLICA = null;') {
  throw 'licencia.js no tiene llave pública. Corre primero: node herramientas\licencia.js llaves'
}

$version = (Get-Content (Join-Path $raiz 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version

$temporal = Join-Path $env:TEMP 'raven-empaque'
$carpeta = Join-Path $temporal 'raven-llenar-respuestas'
if (Test-Path $temporal) { Remove-Item -Recurse -Force $temporal }
New-Item -ItemType Directory -Force $carpeta | Out-Null

$archivos = 'manifest.json', 'background.js', 'popup.html', 'popup.css', 'popup.js', 'bienvenida.html', 'bienvenida.css', 'bienvenida.js', 'llenar.js', 'analizar.js', 'boton.js', 'cedula.js', 'capturas.js', 'licencia.js', 'LICENSE', 'INSTALAR.txt'
foreach ($a in $archivos) { Copy-Item (Join-Path $raiz $a) $carpeta }
Copy-Item -Recurse (Join-Path $raiz 'iconos') $carpeta

$dist = Join-Path $raiz 'dist'
New-Item -ItemType Directory -Force $dist | Out-Null
$zip = Join-Path $dist "raven-llenar-respuestas-v$version.zip"
Compress-Archive -Path $carpeta -DestinationPath $zip -Force
Remove-Item -Recurse -Force $temporal
Write-Output $zip
