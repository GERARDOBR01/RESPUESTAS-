// Utilidades comunes de las pruebas: Playwright, Chromium y la página falsa de captura.
// No hay node_modules aquí a propósito: Chrome carga esta carpeta como extensión.
// Playwright se toma de PLAYWRIGHT_DIR o de una instalación de Node que ya lo tenga.
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

function cargarPlaywright() {
  const candidatos = [process.env.PLAYWRIGHT_DIR, 'playwright', path.join(os.homedir(), 'jobbot', 'node_modules', 'playwright')];
  for (const c of candidatos.filter(Boolean)) {
    try { return require(c); } catch { /* siguiente */ }
  }
  throw new Error('No encontré Playwright. Define PLAYWRIGHT_DIR con la ruta a node_modules/playwright.');
}

// Chrome de marca ya no deja cargar extensiones por línea de comandos; Chromium sí.
function rutaChromium(chromium) {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  try {
    const propia = chromium.executablePath();
    if (fs.existsSync(propia)) return propia;
  } catch { /* sin navegador propio */ }
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const versiones = fs.existsSync(base)
    ? fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => b.split('-')[1] - a.split('-')[1])
    : [];
  for (const v of versiones) {
    const exe = path.join(base, v, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('No encontré Chromium. Corre «npx playwright install chromium» o define CHROMIUM.');
}

// Página parecida a la captura real: encabezado con datos (solo lectura), 5 series de 12.
// variante: 'columnas' (bloques por serie) | 'tabla' (filas) | 'grid' (sin etiquetas)
// rechaza: números de casilla cuya página reescribe el valor al cambiar.
function paginaFalsa({ variante = 'columnas', rechaza = [] } = {}) {
  const encabezado = `
    <header style="height:60px;background:#1e88e5;color:#fff">psicoweb</header>
    <section>
      Cédula: <input readonly value="XXXX000000XXXXXX00">
      Nombre: <input readonly value="Persona de prueba">
      Edad: <input disabled value="40">
    </section>`;
  let cuerpo = '';
  if (variante === 'columnas') {
    for (let c = 0; c < 5; c++) {
      cuerpo += `<div class="col"><div>${'ABCDE'[c]}</div>`;
      for (let r = 1; r <= 12; r++) {
        const n = c * 12 + r;
        cuerpo += `<div class="fila"><span>${n}.-</span><input type="text" name="r${n}"></div>`;
      }
      cuerpo += '</div>';
    }
  } else if (variante === 'tabla') {
    cuerpo = '<table>';
    for (let r = 1; r <= 12; r++) {
      cuerpo += '<tr>';
      for (let c = 0; c < 5; c++) {
        const n = c * 12 + r;
        cuerpo += `<td>${n}.-</td><td><input name="r${n}"></td>`;
      }
      cuerpo += '</tr>';
    }
    cuerpo += '</table>';
  } else {
    cuerpo = '<div style="display:grid;grid-template-columns:repeat(5,200px);gap:4px">';
    for (let r = 1; r <= 12; r++) for (let c = 0; c < 5; c++) cuerpo += `<div><input name="r${c * 12 + r}"></div>`;
    cuerpo += '</div>';
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Raven</title>
    <style>
      body { font: 14px sans-serif; margin: 0; }
      .col { display: inline-block; width: 230px; vertical-align: top; }
      .fila { height: 40px; } input { width: 90px; height: 34px; }
    </style></head><body>${encabezado}<main>${cuerpo}</main>
    <button id="guardar">Guardar</button>
    <script>
      window.cambios = 0;
      document.addEventListener('change', () => window.cambios++);
      for (const n of ${JSON.stringify(rechaza)}) {
        const el = document.querySelector('input[name=r' + n + ']');
        el.addEventListener('change', () => { el.value = ''; });
      }
    </script></body></html>`;
}

module.exports = { RAIZ, cargarPlaywright, rutaChromium, paginaFalsa };
