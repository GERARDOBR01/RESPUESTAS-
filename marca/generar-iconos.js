// Genera iconos/icono-{16,32,48,128}.png a partir de marca/logo.svg.
// Uso: node marca/generar-iconos.js
const fs = require('fs');
const path = require('path');
const { RAIZ, cargarPlaywright, rutaChromium } = require('../pruebas/entorno');

const TAMANOS = [16, 32, 48, 128];

(async () => {
  const { chromium } = cargarPlaywright();
  const svg = fs.readFileSync(path.join(RAIZ, 'marca', 'logo.svg'), 'utf8');
  const salida = path.join(RAIZ, 'iconos');
  fs.mkdirSync(salida, { recursive: true });
  const navegador = await chromium.launch({ executablePath: rutaChromium(chromium) });
  for (const t of TAMANOS) {
    const pagina = await navegador.newPage({ viewport: { width: t, height: t } });
    const ajustado = svg.replace(/width="128" height="128"/, `width="${t}" height="${t}"`);
    await pagina.setContent(`<html><body style="margin:0;background:transparent">${ajustado}</body></html>`);
    await pagina.locator('svg').screenshot({ path: path.join(salida, `icono-${t}.png`), omitBackground: true });
    await pagina.close();
    console.log(`iconos/icono-${t}.png`);
  }
  await navegador.close();
})().catch((e) => { console.error(e); process.exit(1); });
