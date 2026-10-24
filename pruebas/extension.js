// Prueba de punta a punta con la extensión cargada de verdad en Chromium:
// content script, popup, chrome.storage, chrome.scripting y recarga de la extensión.
// La página de PsicoWeb se sustituye por una falsa (misma URL, sin datos reales).
// Uso: node pruebas/extension.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RAIZ, cargarPlaywright, rutaChromium, paginaFalsa } = require('./entorno');

const URL_RAVEN = 'https://app.psicoweb.com/Raven/IntroducirRespuestas?cedula=PRUEBA';
const URL_RAVEN_MINUSCULAS = 'https://app.psicoweb.com/raven/introducirrespuestas?cedula=PRUEBA';

const ok = (m) => console.log('✓ ' + m);

(async () => {
  const { chromium } = cargarPlaywright();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-prueba-'));
  const ctx = await chromium.launchPersistentContext(perfil, {
    executablePath: rutaChromium(chromium),
    headless: true,
    viewport: { width: 1300, height: 900 },
    args: [`--disable-extensions-except=${RAIZ}`, `--load-extension=${RAIZ}`],
  });
  let opcionesPagina = {};
  await ctx.route('https://app.psicoweb.com/**', (ruta) =>
    ruta.fulfill({ contentType: 'text/html; charset=utf-8', body: paginaFalsa(opcionesPagina) }));

  try {
    // --- ID de la extensión y errores de carga
    const ext = await ctx.newPage();
    await ext.goto('chrome://extensions');
    const info = await ext.evaluate(() => new Promise((r) => chrome.developerPrivate.getExtensionsInfo(r)));
    const yo = info.find((e) => e.name === 'Raven · llenar respuestas');
    assert.ok(yo, 'la extensión cargó');
    assert.deepEqual(yo.manifestErrors || [], [], 'sin errores de manifest');
    const ID = yo.id;
    await ext.close();
    ok(`extensión cargada (${yo.version}, sin errores de manifest)`);

    // --- Botón en la página, sin respuestas
    const raven = await ctx.newPage();
    const erroresRaven = [];
    raven.on('pageerror', (e) => erroresRaven.push(e.message));
    await raven.goto(URL_RAVEN);
    const boton = raven.locator('#raven-llenar button');
    await boton.waitFor();
    assert.equal(await boton.textContent(), 'Captura las respuestas en la extensión');
    assert.equal(await boton.getAttribute('aria-disabled'), 'true');
    await boton.click({ force: true }); // inactivo: no hace nada
    assert.equal(await raven.inputValue('input[name=r1]'), '');
    ok('botón en la página (content script), inactivo sin respuestas');

    // --- Popup real. Abierto en pestaña, su «pestaña activa» sería él mismo; se le
    // indica que la activa es la del Raven. Todo lo demás es la API real de Chrome.
    const abrirPopup = async (url = 'https://app.psicoweb.com/*') => {
      const p = await ctx.newPage();
      const errores = [];
      p.on('pageerror', (e) => errores.push(e.message));
      p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
      await p.addInitScript((patron) => {
        const original = chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = (q) => (q && q.active ? original({ url: patron }) : original(q));
      }, url);
      await p.goto(`chrome-extension://${ID}/popup.html`);
      await p.waitForFunction(() => document.getElementById('pagina').textContent !== '');
      return { p, errores };
    };

    let { p: popup, errores } = await abrirPopup();
    assert.equal(await popup.textContent('#pagina'), 'Página de captura del Raven detectada.');
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'r1');

    // Captura tecleando: salta sola, Backspace regresa, letras no entran
    const respuestas = Array.from({ length: 60 }, (_, i) => String((i % 8) + 1));
    await popup.keyboard.type(respuestas.slice(0, 30).join(''));
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'r31');
    await popup.keyboard.press('Backspace');
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'r30');
    await popup.keyboard.type('x' + respuestas[29]);
    await popup.keyboard.type(respuestas.slice(30).join(''));
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'llenar', 'tras la 60 pasa al botón');
    assert.equal(await popup.textContent('#contador'), '60 / 60');
    const guardadas = await popup.evaluate(() => chrome.storage.local.get('respuestas'));
    assert.deepEqual(guardadas.respuestas, respuestas, 'chrome.storage tiene lo tecleado');
    ok('popup: captura con teclado y guardado en chrome.storage');

    // El botón de la página se actualizó solo
    await raven.waitForFunction(() =>
      document.querySelector('#raven-llenar').shadowRoot.textContent.includes('60/60'));
    ok('botón de la página se actualiza en vivo (60/60)');

    // Llenar desde el popup (Enter sobre «Llenar página»)
    await popup.keyboard.press('Enter');
    await popup.waitForFunction(() => document.getElementById('estado').textContent !== '');
    assert.match(await popup.textContent('#estado'), /Listo: 60 casillas/);
    const leer = () => raven.evaluate(() => [...document.querySelectorAll('main input')].map((i) => i.value));
    const ordenadas = async () => {
      const v = await raven.evaluate(() =>
        Object.fromEntries([...document.querySelectorAll('main input')].map((i) => [i.name, i.value])));
      return Array.from({ length: 60 }, (_, i) => v['r' + (i + 1)]);
    };
    assert.deepEqual(await ordenadas(), respuestas);
    ok('popup → «Llenar página» llena las 60 en su lugar');

    // Pegar desde Excel: «10» no se recorta a «0»
    await popup.click('#r1');
    await popup.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text', ['7', '10', '', '5'].join(String.fromCharCode(13, 10)));
      document.getElementById('r1').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    assert.deepEqual(await popup.evaluate(() => ['r1', 'r2', 'r3', 'r4'].map((id) => document.getElementById(id).value)), ['7', '', '', '5']);
    assert.match(await popup.textContent('#estado'), /no eran un dígito: 2 \(«10»\)/);
    // Se restauran las respuestas
    await popup.evaluate((v) => {
      v.forEach((x, i) => { document.getElementById('r' + (i + 1)).value = x; });
      return chrome.storage.local.set({ respuestas: v });
    }, respuestas);
    ok('pegar: valores de más de un dígito se avisan, no se recortan');
    assert.deepEqual(errores, [], 'popup sin errores: ' + errores.join(' | '));
    await popup.close();

    // --- Botón de la página llena con un clic
    await raven.evaluate(() => document.querySelectorAll('main input').forEach((i) => { i.value = ''; }));
    await boton.click();
    assert.match(await boton.textContent(), /✓ 60 llenadas/);
    assert.deepEqual(await ordenadas(), respuestas);
    ok('botón de la página → llena las 60');

    // --- Arrastrar el botón: no llena, y recuerda la posición
    await raven.evaluate(() => document.querySelectorAll('main input').forEach((i) => { i.value = ''; }));
    await raven.waitForTimeout(2600); // que termine el mensaje
    const caja = await boton.boundingBox();
    await raven.mouse.move(caja.x + 20, caja.y + caja.height / 2);
    await raven.mouse.down();
    await raven.mouse.move(caja.x - 300, caja.y - 400, { steps: 8 });
    await raven.mouse.up();
    assert.ok((await leer()).every((v) => v === ''), 'arrastrar no llena');
    const movida = await boton.boundingBox();
    const esperada = { x: caja.x - 320, y: caja.y - 400 - caja.height / 2 };
    assert.ok(Math.abs(movida.x - esperada.x) < 3 && Math.abs(movida.y - esperada.y) < 3,
      `se movió: ${JSON.stringify(movida)} vs ${JSON.stringify(esperada)}`);
    await raven.waitForTimeout(200);
    await raven.reload();
    await boton.waitFor();
    await raven.waitForFunction(() =>
      document.querySelector('#raven-llenar').shadowRoot.textContent.includes('60/60'));
    const recargada = await boton.boundingBox();
    assert.ok(Math.abs(recargada.x + recargada.width - (movida.x + movida.width)) < 3 &&
      Math.abs(recargada.y - movida.y) < 3, 'posición recordada');
    // Una ventana más chica no lo deja fuera de la vista
    await raven.setViewportSize({ width: 500, height: 300 });
    await raven.waitForTimeout(100);
    const chica = await boton.boundingBox();
    assert.ok(chica.x >= 0 && chica.y >= 0 && chica.x + chica.width <= 500 && chica.y + chica.height <= 300, 'dentro de la vista');
    await raven.setViewportSize({ width: 1300, height: 900 });
    ok('arrastrar el botón no llena; posición recordada y siempre visible');

    // --- Recarga de la extensión (↻): el botón viejo queda huérfano
    // Igual que el botón ↻ de chrome://extensions
    const extensiones = await ctx.newPage();
    await extensiones.goto('chrome://extensions');
    // Como en tu Chrome: con «Modo de desarrollador» activado (si no, ↻ la desactiva)
    await extensiones.evaluate(() => new Promise((r) =>
      chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, r)));
    await extensiones.evaluate((id) => new Promise((r) => chrome.developerPrivate.reload(id, { failQuietly: true }, r)), ID);
    let estado;
    for (let i = 0; i < 40; i++) {
      estado = await extensiones.evaluate((id) => new Promise((r) => chrome.developerPrivate.getExtensionInfo(id, r)), ID);
      if (estado.state === 'ENABLED') break;
      await extensiones.waitForTimeout(250);
    }
    assert.equal(estado.state, 'ENABLED', 'sigue activa tras ↻: ' + JSON.stringify(estado.disableReasons));
    await extensiones.close();
    // Cambio de respuestas después de recargar: el botón viejo NO debe usar las de memoria
    const ext2 = await ctx.newPage();
    for (let intento = 0; ; intento++) {
      try { await ext2.goto(`chrome-extension://${ID}/popup.html`); break; } catch (e) {
        if (intento > 20) throw e;
        await ext2.waitForTimeout(250); // la extensión todavía se está recargando
      }
    }
    const nuevas = respuestas.map((v) => String(9 - +v));
    await ext2.evaluate((v) => chrome.storage.local.set({ respuestas: v }), nuevas);
    await ext2.close();
    await raven.evaluate(() => document.querySelectorAll('main input').forEach((i) => { i.value = ''; }));
    await boton.click();
    assert.match(await boton.textContent(), /recarga la página/);
    assert.ok((await leer()).every((v) => v === ''), 'el huérfano no llena con datos viejos');
    ok('tras ↻ el botón viejo avisa «recarga la página» y no llena con datos viejos');

    // Abrir la extensión reemplaza el botón huérfano por uno vivo
    ({ p: popup, errores } = await abrirPopup());
    await popup.waitForTimeout(300);
    assert.equal(await raven.locator('#raven-llenar').count(), 1, 'un solo botón');
    await raven.waitForFunction(() =>
      document.querySelector('#raven-llenar').shadowRoot.textContent.includes('60/60'));
    await boton.click();
    assert.match(await boton.textContent(), /✓ 60 llenadas/);
    assert.deepEqual(await ordenadas(), nuevas, 'llena con las respuestas nuevas');
    // Abrir otra vez no duplica ni reemplaza el vivo
    await popup.close();
    ({ p: popup } = await abrirPopup());
    await popup.waitForTimeout(300);
    assert.equal(await raven.locator('#raven-llenar').count(), 1);
    await popup.close();
    ok('abrir la extensión reemplaza el botón huérfano; no se duplica');

    // --- Ruta en minúsculas: Chrome no pone el content script, el popup sí
    await raven.goto(URL_RAVEN_MINUSCULAS);
    await raven.waitForTimeout(300);
    assert.equal(await raven.locator('#raven-llenar').count(), 0);
    ({ p: popup } = await abrirPopup());
    await raven.locator('#raven-llenar button').waitFor();
    ok('ruta en minúsculas: el popup pone el botón');
    await popup.close();

    // --- La página rechaza valores: se avisa
    opcionesPagina = { rechaza: [12] };
    await raven.goto(URL_RAVEN);
    await boton.waitFor();
    await raven.waitForFunction(() =>
      document.querySelector('#raven-llenar').shadowRoot.textContent.includes('60/60'));
    await boton.click();
    assert.match(await boton.textContent(), /no aceptó la 12/);
    opcionesPagina = {};
    ok('si la página rechaza un valor, el botón lo dice');

    // --- Fuera de PsicoWeb
    const otra = await ctx.newPage();
    await otra.route('https://example.org/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>otra</p>' }));
    await otra.goto('https://example.org/');
    ({ p: popup } = await abrirPopup('https://example.org/*'));
    assert.ok(await popup.isDisabled('#llenar'));
    assert.equal(await otra.locator('#raven-llenar').count(), 0);
    await popup.close();
    ok('fuera de PsicoWeb: se captura pero no se llena ni se inyecta nada');

    // --- Borrar todo pide dos clics y el botón de la página se apaga
    ({ p: popup } = await abrirPopup());
    await popup.click('#borrar');
    assert.equal(await popup.textContent('#contador'), '60 / 60');
    await popup.click('#borrar');
    assert.equal(await popup.textContent('#contador'), '0 / 60');
    await raven.waitForFunction(() =>
      document.querySelector('#raven-llenar').shadowRoot.textContent.includes('Captura las respuestas'));
    ok('«Borrar todo» con confirmación; el botón de la página se apaga');

    assert.deepEqual(erroresRaven, [], 'página sin errores: ' + erroresRaven.join(' | '));
    console.log('Extensión: todo bien.');
  } finally {
    await ctx.close();
    fs.rmSync(perfil, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
