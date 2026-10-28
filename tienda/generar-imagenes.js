// Genera las imágenes de 1280×800 para la ficha de la Chrome Web Store en tienda/imagenes/.
// Usa la extensión de verdad con una licencia de prueba y la página falsa de las pruebas
// (sin datos reales). Uso: node tienda/generar-imagenes.js
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RAIZ, cargarPlaywright, rutaChromium, paginaFalsa } = require('../pruebas/entorno');
const { firmarClave, publicaJwk, escribirPublica } = require('../herramientas/licencia.js');

const SALIDA = path.join(__dirname, 'imagenes');
const ANA = '312465732184657321846573214865732148657321846573216548732165';
const BETO = '456732184657321846573221846573214865732148657321654873216541';

(async () => {
  const { chromium } = cargarPlaywright();
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-tienda-'));
  const extension = path.join(temporal, 'extension');
  fs.cpSync(RAIZ, extension, { recursive: true, filter: (f) => !/[\\/](\.git|dist|node_modules)$/.test(f) });
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  escribirPublica(publicaJwk(privateKey), path.join(extension, 'licencia.js'));
  const vence = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const ctx = await chromium.launchPersistentContext(path.join(temporal, 'perfil'), {
    executablePath: rutaChromium(chromium),
    headless: true,
    deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await ctx.route('https://app.psicoweb.com/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: paginaFalsa() }));
  fs.mkdirSync(SALIDA, { recursive: true });
  try {
    const ext = await ctx.newPage();
    await ext.goto('chrome://extensions');
    const info = await ext.evaluate(() => new Promise((r) => chrome.developerPrivate.getExtensionsInfo(r)));
    const ID = info.find((e) => e.name === 'Raven · llenar respuestas').id;
    await ext.goto(`chrome-extension://${ID}/popup.html`);
    await ext.evaluate((clave) => chrome.storage.local.set({ licencia: clave }), firmarClave(privateKey, 'Clínica Ejemplo', vence).clave);
    for (const p of ctx.pages()) if (p.url().endsWith('bienvenida.html')) await p.close();

    const raven = await ctx.newPage();
    await raven.setViewportSize({ width: 1280, height: 800 });
    await raven.goto('https://app.psicoweb.com/Raven/IntroducirRespuestas?cedula=AAAA000000AAAAAA01');

    const popup = async (preparar) => {
      const p = await ctx.newPage();
      await p.setViewportSize({ width: 560, height: 900 });
      await p.addInitScript(() => {
        const original = chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = (q) => (q && q.active ? original({ url: 'https://app.psicoweb.com/*' }) : original(q));
      });
      await p.goto(`chrome-extension://${ID}/popup.html`);
      await p.waitForFunction(() => document.documentElement.dataset.listo === 'si');
      if (preparar) await preparar(p);
      await p.waitForTimeout(200);
      const png = await p.locator('main').screenshot();
      await p.close();
      return png;
    };

    // Imagen 1: la cola con dos candidatos
    const cola = await popup(async (p) => {
      await p.fill('#nombre', 'Beto Ruiz');
      await p.fill('#cedula', 'BBBB000000BBBBBB02');
      await p.press('#cedula', 'Enter');
      await p.keyboard.type(BETO);
      await p.click('#nueva');
      await p.fill('#nombre', 'Ana López');
      await p.fill('#cedula', 'AAAA000000AAAAAA01');
      await p.press('#cedula', 'Enter');
      await p.keyboard.type(ANA);
      await p.evaluate(() => document.activeElement.blur());
    });
    // Imagen 2: la página llena con el botón
    await raven.reload();
    await raven.locator('#raven-llenar button').click();
    await raven.waitForTimeout(500);
    const pagina = await raven.screenshot();

    const componer = async (archivo, titulo, texto, img, ancho) => {
      const p = await ctx.newPage();
      await p.setViewportSize({ width: 1280, height: 800 });
      await p.setContent(`<!doctype html><html><body style="margin:0;width:1280px;height:800px;display:flex;align-items:center;gap:48px;padding:0 64px;box-sizing:border-box;font-family:system-ui,'Segoe UI',sans-serif;color:#1d2433;background:radial-gradient(circle at 15% 10%,rgba(229,72,77,.22),transparent 45%),radial-gradient(circle at 90% 85%,rgba(30,136,229,.25),transparent 50%),#eef1f6">
        <div style="flex:1"><h1 style="font-size:40px;line-height:1.15;margin:0 0 16px">${titulo}</h1><p style="font-size:20px;line-height:1.45;color:#5b6475;margin:0">${texto}</p></div>
        <img src="data:image/png;base64,${img.toString('base64')}" style="width:${ancho}px;border-radius:14px;box-shadow:0 18px 48px rgba(29,36,51,.22)">
      </body></html>`);
      await p.screenshot({ path: path.join(SALIDA, archivo) });
      await p.close();
      console.log('tienda/imagenes/' + archivo);
    };
    await componer('1-captura.png', 'Captura las 60 respuestas una vez',
      'Escribes el número y salta sola a la siguiente. Para aplicaciones en grupo, cada candidato con su cédula en la cola.', cola, 520);
    await componer('2-llenar.png', 'Llénalas en PsicoWeb con un clic',
      'Al abrir la captura de cada candidato, sus respuestas se usan solas. Tú revisas y guardas.', pagina, 700);
  } finally {
    await ctx.close();
    fs.rmSync(temporal, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
