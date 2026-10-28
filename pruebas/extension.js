// Prueba de punta a punta con la extensión cargada de verdad en Chromium:
// content script, popup, service worker, chrome.storage, chrome.scripting y recarga.
// La página de PsicoWeb se sustituye por una falsa (misma URL, sin datos reales).
// Se prueba una copia de la extensión con una llave de licencia de prueba (la real no
// está en el repo); todo lo demás es el código tal cual.
// Uso: node pruebas/extension.js
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RAIZ, cargarPlaywright, rutaChromium, paginaFalsa } = require('./entorno');
const { firmarClave, publicaJwk, escribirPublica } = require('../herramientas/licencia.js');
const { huellaCedula } = require('../cedula.js');

const BASE = 'https://app.psicoweb.com/Raven/IntroducirRespuestas?cedula=';
const URL_RAVEN = BASE + 'PRUEBA';
const URL_OTRA = BASE + 'OTRA';
const URL_RAVEN_MINUSCULAS = 'https://app.psicoweb.com/raven/introducirrespuestas?cedula=PRUEBA';

const ok = (m) => console.log('✓ ' + m);

// Fecha local 'AAAA-MM-DD' a `dias` de hoy.
const fechaEn = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
};

(async () => {
  const { chromium } = cargarPlaywright();
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-prueba-'));
  const perfil = path.join(temporal, 'perfil');
  const extension = path.join(temporal, 'extension');
  fs.cpSync(RAIZ, extension, { recursive: true, filter: (f) => !/[\\/](\.git|dist|node_modules)$/.test(f) });
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  escribirPublica(publicaJwk(privateKey), path.join(extension, 'licencia.js'));
  const clave = (vence) => firmarClave(privateKey, 'Clínica de prueba', vence).clave;
  const CLAVE = clave(fechaEn(365));

  const ctx = await chromium.launchPersistentContext(perfil, {
    executablePath: rutaChromium(chromium),
    headless: true,
    viewport: { width: 1300, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  let opcionesPagina = {};
  for (const origen of ['https://app.psicoweb.com/**', 'http://app.psicoweb.com/**']) {
    await ctx.route(origen, (ruta) =>
      ruta.fulfill({ contentType: 'text/html; charset=utf-8', body: paginaFalsa(opcionesPagina) }));
  }

  try {
    // --- ID de la extensión y errores de carga
    const ext = await ctx.newPage();
    await ext.goto('chrome://extensions');
    const info = await ext.evaluate(() => new Promise((r) => chrome.developerPrivate.getExtensionsInfo(r)));
    const yo = info.find((e) => e.name === 'Raven · llenar respuestas');
    assert.ok(yo, 'la extensión cargó');
    assert.deepEqual(yo.manifestErrors || [], [], 'sin errores de manifest');
    assert.deepEqual(yo.runtimeErrors || [], [], 'sin errores del service worker');
    const ID = yo.id;
    // Los íconos del manifest existen y cargan
    const manifest = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
    await ext.goto(`chrome-extension://${ID}/popup.html`);
    for (const [t, archivo] of Object.entries(manifest.icons)) {
      const medida = await ext.evaluate(async (url) => {
        const img = new Image(); img.src = url; await img.decode();
        return [img.naturalWidth, img.naturalHeight];
      }, `chrome-extension://${ID}/${archivo}`);
      assert.deepEqual(medida, [+t, +t], `ícono ${t}`);
    }
    await ext.close();
    // Al instalar se abre la bienvenida con la activación
    let bienvenida = ctx.pages().find((p) => p.url().endsWith('/bienvenida.html'));
    for (let i = 0; !bienvenida && i < 20; i++) {
      await new Promise((r) => setTimeout(r, 250));
      bienvenida = ctx.pages().find((p) => p.url().endsWith('/bienvenida.html'));
    }
    assert.ok(bienvenida, 'se abrió la bienvenida al instalar');
    await bienvenida.waitForLoadState();
    await bienvenida.fill('#clave', 'RAVEN1.mala.clave');
    await bienvenida.click('#guardarClave');
    await bienvenida.waitForFunction(() => /no es válida/.test(document.getElementById('licenciaTexto').textContent));
    assert.match(await bienvenida.textContent('#contacto'), /Soporte:/);
    await bienvenida.close();
    ok(`extensión cargada (${yo.version}, sin errores de manifest, íconos ${Object.keys(manifest.icons).join('/')}); abre la bienvenida`);

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

    const botonDice = (texto) => raven.waitForFunction((t) =>
      document.querySelector('#raven-llenar')?.shadowRoot.textContent.includes(t), texto);
    // El clic del botón es asíncrono (pregunta la licencia): se espera a que diga algo.
    const botonCumple = (patron) => raven.waitForFunction((fuente) =>
      new RegExp(fuente).test(document.querySelector('#raven-llenar')?.shadowRoot.querySelector('.texto').textContent),
    patron.source, { timeout: 5000 }).catch(async () => assert.match(await boton.textContent(), patron));
    const leer = () => raven.evaluate(() => [...document.querySelectorAll('main input')].map((i) => i.value));
    const vaciar = () => raven.evaluate(() => document.querySelectorAll('main input').forEach((i) => { i.value = ''; }));
    const ordenadas = async () => {
      const v = await raven.evaluate(() =>
        Object.fromEntries([...document.querySelectorAll('main input')].map((i) => [i.name, i.value])));
      return Array.from({ length: 60 }, (_, i) => v['r' + (i + 1)]);
    };

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
      await p.waitForFunction(() => document.documentElement.dataset.listo === 'si');
      return { p, errores };
    };
    // Espera a que un texto del popup cumpla el patrón (los clics ahí son asíncronos)
    const esperarTexto = (p, selector, patron) => p.waitForFunction(([sel, fuente]) =>
      new RegExp(fuente).test(document.querySelector(sel).textContent), [selector, patron.source], { timeout: 5000 })
      .catch(async () => assert.match(await p.textContent(selector), patron));
    // Almacén de la extensión (desde una página suya fuera de PsicoWeb: no toca nada)
    const almacen = async (cambiar) => {
      const p = await ctx.newPage();
      await p.goto(`chrome-extension://${ID}/popup.html`);
      if (cambiar) await p.evaluate(cambiar);
      const datos = await p.evaluate(() => chrome.storage.local.get(null));
      await p.close();
      return datos;
    };

    // --- Licencia: sin clave no llena; una clave mala o vencida no se acepta
    let { p: popup, errores } = await abrirPopup();
    assert.equal(await popup.textContent('#pagina'), 'Página de captura del Raven detectada.');
    assert.ok(await popup.isVisible('#licencia'), 'pide la licencia');
    assert.match(await popup.textContent('#licenciaTexto'), /Activa la extensión/);
    assert.ok(await popup.isDisabled('#llenar'), 'sin licencia no se llena');
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'clave');
    await popup.fill('#clave', 'RAVEN1.esto.noesunaclave');
    await popup.click('#guardarClave');
    await esperarTexto(popup, '#licenciaTexto', /no es válida/);
    await popup.fill('#clave', clave(fechaEn(-30)));
    await popup.click('#guardarClave');
    await esperarTexto(popup, '#licenciaTexto', /venció/);
    assert.equal((await almacen()).licencia, null, 'no se guardó la clave vencida');
    // Pegada en dos renglones, como llega a veces por correo
    await popup.fill('#clave', CLAVE.slice(0, 50) + '\n' + CLAVE.slice(50));
    await popup.click('#guardarClave');
    await popup.waitForFunction(() => document.getElementById('licencia').hidden);
    assert.match(await popup.textContent('#estado'), /Licencia activada: Clínica de prueba/);
    assert.match(await popup.textContent('#licenciaPie'), /Clínica de prueba · vence el/);
    assert.ok(!(await popup.isDisabled('#llenar')));
    ok('licencia: pide clave, rechaza mala y vencida, activa la buena');

    // Captura tecleando: salta sola, Backspace regresa, letras no entran
    await popup.click('#r1');
    const respuestas = Array.from({ length: 60 }, (_, i) => String((i % 8) + 1));
    await popup.keyboard.type(respuestas.slice(0, 30).join(''));
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'r31');
    await popup.keyboard.press('Backspace');
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'r30');
    await popup.keyboard.type('x' + respuestas[29]);
    await popup.keyboard.type(respuestas.slice(30).join(''));
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'llenar', 'tras la 60 pasa al botón');
    assert.equal(await popup.textContent('#contador'), '60 / 60');
    const guardadas = await popup.evaluate(() => chrome.storage.local.get('capturas'));
    assert.deepEqual(guardadas.capturas[0].respuestas, respuestas, 'chrome.storage tiene lo tecleado');
    assert.equal(guardadas.capturas[0].huella, huellaCedula('PRUEBA'), 'ligada a la cédula donde se tecleó');
    ok('popup: captura con teclado y guardado en chrome.storage');

    // El botón de la página se actualizó solo
    await botonDice('60/60');
    await botonCumple(/Candidato 1 \(…UEBA\)/);
    ok('botón de la página se actualiza en vivo y dice de quién son');

    // Llenar desde el popup (Enter sobre «Llenar página»)
    await popup.keyboard.press('Enter');
    await popup.waitForFunction(() => document.getElementById('estado').textContent.startsWith('Listo'));
    assert.match(await popup.textContent('#estado'), /Listo: 60 casillas/);
    assert.deepEqual(await ordenadas(), respuestas);
    assert.match(await popup.evaluate(() => document.getElementById('capturas').selectedOptions[0].textContent), /✓ llenada/);
    ok('popup → «Llenar página» llena las 60 en su lugar y la marca como llenada');

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
      document.getElementById('r60').dispatchEvent(new Event('input'));
    }, respuestas);
    ok('pegar: valores de más de un dígito se avisan, no se recortan');
    assert.deepEqual(errores, [], 'popup sin errores: ' + errores.join(' | '));
    await popup.close();

    // --- Botón de la página llena con un clic
    await vaciar();
    await botonDice('Llenar · Candidato 1');
    await boton.click();
    await botonCumple(/✓ 60 llenadas/);
    assert.deepEqual(await ordenadas(), respuestas);
    ok('botón de la página → llena las 60');

    // --- Arrastrar el botón: no llena, y recuerda la posición
    await vaciar();
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
    await botonDice('60/60');
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
    const nuevas = respuestas.map((v) => String(9 - +v));
    for (let intento = 0; ; intento++) {
      try {
        await almacen(async () => {
          const { capturas } = await chrome.storage.local.get('capturas');
          capturas[0].respuestas = capturas[0].respuestas.map((v) => String(9 - +v));
          await chrome.storage.local.set({ capturas });
        });
        break;
      } catch (e) {
        if (intento > 20) throw e;
        await raven.waitForTimeout(250); // la extensión todavía se está recargando
      }
    }
    await vaciar();
    await boton.click();
    await botonCumple(/recarga la página/);
    assert.ok((await leer()).every((v) => v === ''), 'el huérfano no llena con datos viejos');
    ok('tras ↻ el botón viejo avisa «recarga la página» y no llena con datos viejos');

    // Abrir la extensión reemplaza el botón huérfano por uno vivo
    ({ p: popup, errores } = await abrirPopup());
    await popup.waitForTimeout(300);
    assert.equal(await raven.locator('#raven-llenar').count(), 1, 'un solo botón');
    await botonDice('60/60');
    await boton.click();
    await botonCumple(/✓ 60 llenadas/);
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
    await botonDice('60/60');
    await boton.click();
    await botonCumple(/no aceptó la 12/);
    opcionesPagina = {};
    ok('si la página rechaza un valor, el botón lo dice');

    // --- Aviso por cédula: no llenar a un candidato con las respuestas de otro
    assert.ok(!JSON.stringify(await almacen()).includes('PRUEBA'), 'no se guarda la cédula, solo su huella');

    // Botón de la página en otra cédula: primer clic avisa y no llena; segundo llena
    await raven.goto(URL_OTRA);
    await botonDice('60/60');
    await boton.click();
    await botonCumple(/otra cédula/);
    assert.ok((await leer()).every((v) => v === ''), 'el primer clic no llena');
    await boton.click();
    await botonCumple(/✓ 60 llenadas/);
    assert.deepEqual(await ordenadas(), nuevas);
    assert.equal((await almacen()).capturas[0].huella, huellaCedula('OTRA'), 'al llenar pasan a ser de esta cédula');
    ok('botón: en otra cédula avisa y pide un segundo clic');

    // Popup en la cédula correcta: sin aviso
    ({ p: popup } = await abrirPopup());
    assert.ok(await popup.isHidden('#otra'));
    await popup.close();

    // Popup en otra cédula: aviso visible y «Llenar página» pide confirmación
    await raven.goto(URL_RAVEN);
    await boton.waitFor();
    ({ p: popup, errores } = await abrirPopup());
    assert.ok(await popup.isVisible('#otra'), 'aviso de otra cédula');
    await popup.click('#llenar');
    await esperarTexto(popup, '#estado', /otra cédula/);
    assert.ok((await leer()).every((v) => v === ''), 'el primer clic no llena');
    await popup.click('#llenar');
    await popup.waitForFunction(() => /Listo/.test(document.getElementById('estado').textContent));
    assert.deepEqual(await ordenadas(), nuevas);
    assert.ok(await popup.isHidden('#otra'), 'tras llenar ya son de esta cédula');
    assert.deepEqual(errores, []);
    await popup.close();
    ok('popup: aviso de otra cédula y confirmación al llenar');

    // «Nueva captura para esta cédula»: la anterior se queda; la nueva es del candidato abierto
    await raven.goto(URL_OTRA);
    await boton.waitFor();
    ({ p: popup } = await abrirPopup());
    assert.ok(await popup.isVisible('#otra'));
    await popup.click('#nuevaAqui');
    assert.equal(await popup.textContent('#contador'), '0 / 60');
    assert.ok(await popup.isHidden('#otra'));
    await botonDice('Captura las respuestas');
    await popup.keyboard.type('7');
    await popup.waitForTimeout(150);
    let datos = await almacen();
    assert.equal(datos.capturas.length, 2, 'la captura anterior se conserva');
    assert.equal(datos.capturas[1].huella, huellaCedula('OTRA'));
    assert.equal(datos.capturas[1].respuestas[0], '7');
    await popup.close();
    ok('«Nueva captura para esta cédula» conserva la anterior; la nueva es de la cédula abierta');

    // --- Cola: aplicación en grupo. Se capturan dos candidatos fuera de PsicoWeb y luego
    // cada uno se llena solo al abrir su cédula.
    await almacen(() => chrome.storage.local.remove(['capturas', 'actual']));
    const otra = await ctx.newPage();
    await otra.route('https://example.org/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>otra</p>' }));
    await otra.goto('https://example.org/');
    ({ p: popup, errores } = await abrirPopup('https://example.org/*'));
    const deAna = Array.from({ length: 60 }, (_, i) => String((i % 5) + 1));
    const deBeto = Array.from({ length: 60 }, (_, i) => String((i % 6) + 3));
    await popup.fill('#nombre', 'Ana');
    await popup.fill('#cedula', 'aaaa000000aaaaaa01');
    await popup.press('#cedula', 'Enter');
    assert.match(await popup.textContent('#estado'), /Ligada a la cédula …AA01/);
    assert.equal(await popup.evaluate(() => document.activeElement.id), 'r1', 'Enter en la cédula pasa a la captura');
    await popup.keyboard.type(deAna.join(''));
    await popup.click('#nueva');
    await popup.fill('#nombre', 'Beto');
    await popup.fill('#cedula', 'AAAA000000AAAAAA01');
    await popup.press('#cedula', 'Enter');
    assert.match(await popup.textContent('#estado'), /ya está en «Ana \(…AA01\)»/, 'una cédula no puede estar en dos capturas');
    await popup.fill('#cedula', 'BBBB000000BBBBBB02');
    await popup.press('#cedula', 'Enter');
    await popup.keyboard.type(deBeto.join(''));
    const opciones = await popup.evaluate(() => [...document.getElementById('capturas').options].map((o) => o.textContent));
    assert.deepEqual(opciones, ['Ana (…AA01) · 60/60', 'Beto (…BB02) · 60/60']);
    assert.deepEqual(errores, []);
    await popup.close();
    // En la página de Ana con Beto abierto en la extensión: el aviso lleva a Ana
    await raven.goto(BASE + 'AAAA000000AAAAAA01');
    await almacen(async () => {
      const { capturas } = await chrome.storage.local.get('capturas');
      await chrome.storage.local.set({ actual: capturas[1].id });
    });
    ({ p: popup } = await abrirPopup());
    assert.equal(await popup.inputValue('#nombre'), 'Ana', 'se abre en la captura del candidato de la página');
    await popup.selectOption('#capturas', { index: 1 });
    assert.ok(await popup.isVisible('#otra'));
    assert.equal(await popup.textContent('#nuevaAqui'), 'Ir a Ana (…AA01)');
    await popup.click('#nuevaAqui');
    assert.equal(await popup.inputValue('#nombre'), 'Ana');
    assert.ok(await popup.isHidden('#otra'));
    await popup.close();
    datos = await almacen();
    assert.ok(!JSON.stringify(datos).includes('AAAA000000'), 'tampoco se guarda la cédula escrita a mano');

    await raven.goto(BASE + 'AAAA000000AAAAAA01');
    await botonDice('Llenar · Ana (…AA01) · 60/60');
    await boton.click();
    await botonCumple(/✓ 60 llenadas — revisa y guarda · faltan 1/);
    assert.deepEqual(await ordenadas(), deAna);
    await raven.goto(BASE + 'BBBB000000BBBBBB02');
    await botonDice('Llenar · Beto (…BB02) · 60/60');
    await boton.click();
    await botonCumple(/✓ 60 llenadas — revisa y guarda$/);
    assert.deepEqual(await ordenadas(), deBeto);
    // Abierto en la página de Ana, el popup muestra a Ana aunque la última abierta fue Beto
    await raven.goto(BASE + 'AAAA000000AAAAAA01');
    await botonDice('Llenar otra vez · Ana');
    ({ p: popup } = await abrirPopup());
    assert.equal(await popup.inputValue('#nombre'), 'Ana');
    assert.match(await popup.textContent('#estado'), /Respuestas de «Ana \(…AA01\)» para esta cédula/);
    // Quitar las ya llenadas (con confirmación)
    await popup.click('#quitarLlenadas');
    assert.equal(await popup.evaluate(() => document.getElementById('capturas').options.length), 2);
    await popup.click('#quitarLlenadas');
    assert.equal(await popup.evaluate(() => document.getElementById('capturas').options.length), 1);
    assert.equal(await popup.textContent('#contador'), '0 / 60');
    await popup.close();
    await botonDice('Captura las respuestas');
    ok('cola: dos candidatos capturados de antemano, cada uno se llena solo en su cédula');
    await otra.close();

    // --- Licencia en el botón de la página: vencida no llena; en gracia sí, con aviso
    await almacen(async () => {
      const { capturas } = await chrome.storage.local.get('capturas');
      capturas[0].respuestas = Array(60).fill('4');
      await chrome.storage.local.set({ capturas });
    });
    await raven.goto(URL_RAVEN);
    await botonDice('60/60');
    await almacen(() => chrome.storage.local.remove('licencia'));
    await vaciar();
    await boton.click();
    await botonCumple(/Activa tu licencia/);
    const claveVencida = clave(fechaEn(-8));
    await almacen(new Function(`return chrome.storage.local.set({ licencia: ${JSON.stringify(claveVencida)} })`));
    await boton.click();
    await botonCumple(/licencia venció/);
    assert.ok((await leer()).every((v) => v === ''), 'con la licencia vencida no llena');
    ({ p: popup } = await abrirPopup());
    assert.match(await popup.textContent('#licenciaTexto'), /venció.*Ya no se puede llenar/);
    assert.ok(await popup.isDisabled('#llenar'));
    await popup.close();
    const claveGracia = clave(fechaEn(-2));
    await almacen(new Function(`return chrome.storage.local.set({ licencia: ${JSON.stringify(claveGracia)} })`));
    await boton.click();
    await botonCumple(/✓ 60 llenadas.*licencia vencida/);
    ({ p: popup } = await abrirPopup());
    assert.match(await popup.textContent('#licenciaTexto'), /Seguirá llenando 5 días más/);
    await popup.close();
    ok('licencia en el botón: sin clave o vencida no llena; en gracia llena y avisa');

    // Atrasar el reloj no revive una licencia: cuenta la fecha más reciente ya vista
    await almacen(new Function(`return chrome.storage.local.set({ licencia: ${JSON.stringify(clave(fechaEn(20)))}, licenciaVista: ${Math.round(Date.now() / 86400000) + 60} })`));
    ({ p: popup } = await abrirPopup());
    assert.match(await popup.textContent('#licenciaTexto'), /venció/);
    await popup.close();
    await almacen(new Function(`return chrome.storage.local.set({ licencia: ${JSON.stringify(CLAVE)}, licenciaVista: 0 })`));
    ok('licencia: atrasar el reloj no la revive');

    // --- PsicoWeb por http: aviso y botón para pasar a https
    await raven.goto(URL_RAVEN.replace('https:', 'http:'));
    await boton.waitFor();
    ({ p: popup } = await abrirPopup('http://app.psicoweb.com/*'));
    assert.match(await popup.textContent('#pagina'), /sin cifrar/);
    assert.ok(await popup.isVisible('#https'));
    await popup.click('#https');
    await raven.waitForURL(URL_RAVEN);
    if (!popup.isClosed()) await popup.close();
    await boton.waitFor();
    ok('http: avisa que la conexión no está cifrada y pasa a https');

    // --- Fuera de PsicoWeb
    const fuera = await ctx.newPage();
    await fuera.route('https://example.org/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>otra</p>' }));
    await fuera.goto('https://example.org/');
    ({ p: popup } = await abrirPopup('https://example.org/*'));
    assert.ok(await popup.isDisabled('#llenar'));
    assert.equal(await fuera.locator('#raven-llenar').count(), 0);
    await popup.close();
    await fuera.close();
    ok('fuera de PsicoWeb: se captura pero no se llena ni se inyecta nada');

    // --- Borrar captura pide dos clics y el botón de la página se apaga
    ({ p: popup } = await abrirPopup());
    await popup.click('#borrar');
    assert.equal(await popup.textContent('#contador'), '60 / 60');
    await popup.click('#borrar');
    assert.equal(await popup.textContent('#contador'), '0 / 60');
    await botonDice('Captura las respuestas');
    ok('«Borrar captura» con confirmación; el botón de la página se apaga');

    // --- Lo guardado por la versión 0.5 ({ respuestas, dueno }) pasa a la cola
    await popup.close();
    await almacen(new Function(`return chrome.storage.local.remove(['capturas', 'actual']).then(() =>
      chrome.storage.local.set({ respuestas: ${JSON.stringify(respuestas)}, dueno: ${JSON.stringify(huellaCedula('PRUEBA'))} }))`));
    await raven.reload();
    await botonDice('Llenar · Candidato 1 · 60/60'); // el botón lo lee aunque no se haya convertido
    ({ p: popup } = await abrirPopup());
    assert.equal(await popup.textContent('#contador'), '60 / 60');
    datos = await almacen();
    assert.equal(datos.respuestas, undefined, 'se quitó el formato viejo');
    assert.deepEqual(datos.capturas[0].respuestas, respuestas);
    assert.equal(datos.capturas[0].huella, huellaCedula('PRUEBA'));
    await popup.close();
    ok('actualizar desde 0.5: la captura guardada pasa a la cola');

    assert.deepEqual(erroresRaven, [], 'página sin errores: ' + erroresRaven.join(' | '));
    console.log('Extensión: todo bien.');
  } finally {
    await ctx.close();
    fs.rmSync(temporal, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
