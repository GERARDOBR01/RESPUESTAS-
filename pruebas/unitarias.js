// Pruebas de analizar() y llenar() sobre páginas falsas en Chromium real.
// Uso: node pruebas/unitarias.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { RAIZ, cargarPlaywright, rutaChromium, paginaFalsa } = require('./entorno');
const { analizar } = require('../analizar.js');

const NL = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);

function pruebasAnalizar() {
  const sesenta = Array.from({ length: 60 }, (_, i) => String((i % 8) + 1));
  assert.deepEqual(analizar(sesenta.join(CRLF) + CRLF).respuestas, sesenta, 'columna de Excel');
  assert.deepEqual(analizar(sesenta.join(', ')).respuestas, sesenta, 'una línea con comas');
  assert.deepEqual(analizar(sesenta.join('\t')).respuestas, sesenta, 'una fila de Excel');
  assert.equal(analizar([...sesenta, '3'].join(NL)).respuestas.length, 60, 'recorta a 60');
  const hueco = [...sesenta]; hueco[4] = '';
  const a = analizar(hueco.join(NL));
  assert.equal(a.respuestas[4], '', 'renglón vacío = respuesta en blanco');
  assert.equal(a.respuestas[5], sesenta[5], 'el hueco no recorre las demás');
  assert.ok(analizar('  ' + NL + ' ').error, 'vacío');
  console.log('✓ analizar');
}

function pruebasCedula() {
  const { cedulaDe, huellaCedula } = require('../cedula.js');
  const base = 'https://app.psicoweb.com/Raven/IntroducirRespuestas';
  assert.equal(cedulaDe(`${base}?cedula=abcd010101hdfxyz01`), 'ABCD010101HDFXYZ01');
  assert.equal(cedulaDe(`${base}?x=1&cedula=%20ab12%20`), 'AB12', 'recorta y decodifica');
  assert.equal(cedulaDe(base), null, 'sin cédula');
  assert.equal(cedulaDe(`${base}?cedula=`), null, 'cédula vacía');
  assert.equal(cedulaDe('no es url'), null);
  const h = huellaCedula('ABCD010101HDFXYZ01');
  assert.equal(h, huellaCedula(' abcd010101hdfxyz01 '), 'misma huella sin importar mayúsculas/espacios');
  assert.notEqual(h, huellaCedula('ABCD010101HDFXYZ02'), 'cédulas distintas, huellas distintas');
  assert.ok(!h.toUpperCase().includes('ABCD'), 'la huella no contiene la cédula');
  // Sin choques en un lote de cédulas parecidas
  const huellas = new Set();
  for (let i = 0; i < 5000; i++) huellas.add(huellaCedula('ABCD0101' + String(i).padStart(10, '0')));
  assert.equal(huellas.size, 5000);
  console.log('✓ cédula: lectura de la URL y huella');

  const { segundoClic } = require('../cedula.js');
  let reloj = 1000;
  const pedir = segundoClic(4000, () => reloj);
  assert.equal(pedir(), true, 'primer clic: avisa');
  reloj += 3000;
  assert.equal(pedir(), false, 'segundo clic dentro de la ventana: confirma');
  assert.equal(pedir(), true, 'tras confirmar vuelve a pedir');
  reloj += 4001;
  assert.equal(pedir(), true, 'ventana vencida: vuelve a avisar');
  pedir.cancelar();
  assert.equal(pedir(), true, 'cancelar cierra la ventana');
  console.log('✓ segundo clic');
}

function pruebasCapturas() {
  const C = require('../capturas.js');
  const a = C.nuevaCaptura([]);
  assert.equal(a.nombre, 'Candidato 1');
  assert.equal(a.respuestas.length, 60);
  const b = { ...C.nuevaCaptura([a]), huella: 'hb', pista: 'AB01' };
  assert.equal(b.nombre, 'Candidato 2');
  a.respuestas = Array(60).fill('3');
  b.respuestas = Array(60).fill('4');
  const cola = [a, b];

  assert.deepEqual(C.elegirCaptura(cola, a.id, 'hb'), { captura: b, motivo: 'cedula' }, 'la cédula manda sobre la abierta');
  assert.equal(C.elegirCaptura(cola, a.id, 'hx').motivo, 'libre', 'abierta sin cédula: se usa y se liga');
  assert.equal(C.elegirCaptura(cola, b.id, 'hx').motivo, 'otra', 'abierta de otro candidato: confirmar');
  assert.equal(C.elegirCaptura(cola, b.id, null).motivo, 'actual', 'página sin cédula: la abierta');
  assert.equal(C.elegirCaptura([], null, 'hb').motivo, 'ninguna');

  // Llenar «a» en la cédula de «b»: «a» queda ligada y hecha; «b» se suelta.
  const despues = C.marcarLlenada(cola, a.id, 'hb', 'AB01', 123);
  assert.equal(despues[0].huella, 'hb');
  assert.equal(despues[0].llenada, 123);
  assert.equal(despues[1].huella, null, 'una cédula, una captura');
  assert.equal(cola[0].llenada, null, 'no modifica la cola original');
  assert.equal(C.nombreCorto(despues[0]), 'Candidato 1 (…AB01)');
  assert.equal(C.pistaDe(' abcd010101hdfxyz01 '), 'YZ01');

  // Lo guardado por la versión 0.5 pasa a la cola
  const vieja = Array.from({ length: 60 }, (_, i) => String(i % 7));
  const m = C.migrarCapturas({ respuestas: vieja, dueno: 'hv' });
  assert.equal(m.capturas.length, 1);
  assert.deepEqual(m.capturas[0].respuestas, vieja);
  assert.equal(m.capturas[0].huella, 'hv');
  assert.equal(m.actual, m.capturas[0].id);
  assert.equal(C.migrarCapturas({ capturas: [] }), null, 'ya está al día');
  assert.deepEqual(C.migrarCapturas({}).capturas[0].respuestas, Array(60).fill(''), 'instalación nueva');
  console.log('✓ cola de candidatos');
}

async function pruebasLicencia() {
  const crypto = require('crypto');
  const fs = require('fs');
  const os = require('os');
  const L = require('../licencia.js');
  const { firmarClave, publicaJwk, escribirPublica } = require('../herramientas/licencia.js');
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publica = publicaJwk(privateKey);
  const { clave } = firmarClave(privateKey, 'Clínica Ñandú', '2027-01-31');
  const dia = (f) => L.diaDe(f);
  const ver = (k, hoy) => L.verificarLicencia(k, dia(hoy), publica);

  let r = await ver(clave, '2026-11-01');
  assert.equal(r.estado, 'vigente');
  assert.equal(r.cliente, 'Clínica Ñandú', 'acentos y ñ');
  assert.equal(r.puedeLlenar, true);
  assert.equal((await ver(clave, '2027-01-24')).estado, 'vigente', 'faltan 7 días: todavía sin aviso');
  assert.equal((await ver(clave, '2027-01-25')).estado, 'por-vencer', 'faltan 6: avisa');
  r = await ver(clave, '2027-01-28');
  assert.equal(r.estado, 'por-vencer');
  assert.equal(r.dias, 3);
  assert.equal((await ver(clave, '2027-01-31')).estado, 'por-vencer', 'el día que vence todavía vale');
  r = await ver(clave, '2027-02-07');
  assert.equal(r.estado, 'gracia');
  assert.equal(r.puedeLlenar, true, 'en gracia sigue llenando');
  r = await ver(clave, '2027-02-08');
  assert.equal(r.estado, 'vencida');
  assert.equal(r.puedeLlenar, false);

  const partido = clave.slice(0, 40) + '\n  ' + clave.slice(40);
  assert.equal((await ver(partido, '2026-11-01')).estado, 'vigente', 'tolera saltos de línea al pegar');
  // Cambiar la fecha (o cualquier dato) rompe la firma
  const [p0, , p2] = clave.split('.');
  const alterada = `${p0}.${Buffer.from(JSON.stringify({ c: 'Clínica Ñandú', v: '2099-12-31', e: '2026-10-28', n: '0' })).toString('base64url')}.${p2}`;
  assert.equal((await ver(alterada, '2026-11-01')).estado, 'invalida', 'fecha cambiada a mano');
  const ajena = firmarClave(crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey, 'X', '2099-01-01').clave;
  assert.equal((await ver(ajena, '2026-11-01')).estado, 'invalida', 'firmada con otra llave');
  assert.equal((await ver('hola', '2026-11-01')).estado, 'invalida');
  assert.equal((await ver('', '2026-11-01')).estado, 'falta');
  assert.equal((await L.verificarLicencia(clave, dia('2026-11-01'), null)).estado, 'sin-configurar');
  assert.equal(L.fechaLegible('2027-01-31'), '31 ene 2027');

  // La herramienta escribe la llave pública en licencia.js
  const copia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'raven-lic-')), 'licencia.js');
  fs.copyFileSync(path.join(RAIZ, 'licencia.js'), copia);
  escribirPublica(publica, copia);
  delete require.cache[copia];
  const conLlave = require(copia);
  assert.equal((await conLlave.verificarLicencia(clave, dia('2026-11-01'))).estado, 'vigente');
  console.log('✓ licencia: firma, vigencia, aviso, gracia y claves alteradas');
}

// Lo que carga Chrome (manifest, popup.html, background.js) existe y va en el .zip.
function pruebasArchivos() {
  const manifest = JSON.parse(fs.readFileSync(path.join(RAIZ, 'manifest.json'), 'utf8'));
  const usados = new Set([
    ...manifest.content_scripts.flatMap((c) => c.js),
    manifest.background.service_worker,
    manifest.action.default_popup,
  ]);
  // bienvenida.html la abre background.js al instalar
  usados.add('bienvenida.html');
  for (const pagina of ['popup.html', 'bienvenida.html']) {
    const html = fs.readFileSync(path.join(RAIZ, pagina), 'utf8');
    for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png))"/g)) usados.add(m[1]);
  }
  const fondo = fs.readFileSync(path.join(RAIZ, manifest.background.service_worker), 'utf8');
  for (const m of fondo.matchAll(/importScripts\('([^']+)'\)/g)) usados.add(m[1]);
  const popup = fs.readFileSync(path.join(RAIZ, 'popup.js'), 'utf8');
  for (const m of popup.matchAll(/files: \[([^\]]+)\]/g)) {
    const inyectados = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    assert.deepEqual(inyectados, manifest.content_scripts[0].js, 'el popup inyecta lo mismo que el manifest');
  }
  const empaque = fs.readFileSync(path.join(__dirname, '..', 'herramientas', 'empaquetar.ps1'), 'utf8');
  const lista = /\$archivos = (.+)/.exec(empaque)[1];
  for (const archivo of usados) {
    assert.ok(fs.existsSync(path.join(RAIZ, archivo)), `existe ${archivo}`);
    const enCarpeta = archivo.startsWith('iconos/') && empaque.includes("Join-Path $raiz 'iconos'");
    assert.ok(enCarpeta || lista.includes(`'${archivo}'`), `empaquetar.ps1 incluye ${archivo}`);
  }
  console.log(`✓ archivos: ${usados.size} usados por Chrome, todos existen y van en el .zip`);
}

async function pruebasLlenar() {
  const { chromium } = cargarPlaywright();
  const navegador = await chromium.launch({ executablePath: rutaChromium(chromium) });
  const pagina = await navegador.newPage({ viewport: { width: 1400, height: 1000 } });
  const valores = Array.from({ length: 60 }, (_, i) => String((i % 9) + 1));
  const leerValores = () => pagina.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll('input[name]')].map((i) => [i.name, i.value])));
  const cargar = async (opciones) => {
    await pagina.setContent(paginaFalsa(opciones));
    await pagina.addScriptTag({ path: path.join(RAIZ, 'llenar.js') });
  };

  for (const [variante, metodo] of [['columnas', 'etiqueta'], ['tabla', 'etiqueta'], ['grid', 'posición']]) {
    await cargar({ variante });
    const r = await pagina.evaluate((v) => llenar(v), valores);
    assert.equal(r.error, null, r.error);
    assert.equal(r.metodo, metodo);
    assert.equal(r.llenadas, 60);
    const v = await leerValores();
    for (let n = 1; n <= 60; n++) assert.equal(v['r' + n], valores[n - 1], `${variante}: casilla ${n}`);
    assert.equal(await pagina.evaluate(() => window.cambios), 60, 'dispara change en cada casilla');
    const encabezado = await pagina.evaluate(() => [...document.querySelectorAll('section input')].map((i) => i.value));
    assert.deepEqual(encabezado, ['XXXX000000XXXXXX00', 'Persona de prueba', '40'], 'no toca el encabezado');
    // Llenar otra vez enseguida no deja estilos pegados
    await pagina.evaluate((v) => llenar(v), valores);
    assert.equal(await pagina.evaluate(() => document.querySelectorAll('input[name][style]').length), 0);
    console.log(`✓ llenar · ${variante} (${metodo})`);
  }

  // Con casillas en blanco: la página queda igual que la extensión
  await cargar({});
  await pagina.fill('input[name=r20]', '9');
  const blancos = [...valores]; blancos[19] = ''; blancos[59] = '';
  let r = await pagina.evaluate((v) => llenar(v), blancos);
  assert.equal(r.error, null);
  assert.equal(r.llenadas, 58);
  assert.deepEqual(r.enBlanco, [20, 60]);
  assert.equal((await leerValores()).r20, '');
  console.log('✓ llenar · casillas en blanco');

  // La página reescribe dos casillas: se avisa en vez de decir «listo»
  await cargar({ rechaza: [5, 33] });
  r = await pagina.evaluate((v) => llenar(v), valores);
  assert.match(r.error, /no aceptó las 5, 33/);
  assert.equal(r.llenadas, 58);
  console.log('✓ llenar · detecta valores que la página no aceptó');

  // Página que no es la captura
  await pagina.setContent('<input><input>');
  await pagina.addScriptTag({ path: path.join(RAIZ, 'llenar.js') });
  r = await pagina.evaluate((v) => llenar(v), valores);
  assert.equal(r.llenadas, 0);
  assert.equal(r.metodo, null);
  assert.ok(r.error);
  console.log('✓ llenar · otra página no se toca');

  // Muestras reales de la captura (HTML guardado de PsicoWeb sin datos del candidato).
  const carpeta = path.join(__dirname, 'muestras');
  const muestras = fs.existsSync(carpeta) ? fs.readdirSync(carpeta).filter((f) => f.endsWith('.html')) : [];
  for (const archivo of muestras) {
    await pagina.setContent(fs.readFileSync(path.join(carpeta, archivo), 'utf8'));
    await pagina.addScriptTag({ path: path.join(RAIZ, 'llenar.js') });
    r = await pagina.evaluate((v) => llenar(v), valores);
    assert.equal(r.error, null, `${archivo}: ${r.error}`);
    assert.equal(r.llenadas, 60, archivo);
    // Orden: se llena una casilla a la vez y se ubica en pantalla. La página real tiene
    // 5 series (A–E) de 12 hacia abajo: n+1 queda debajo de n y cada serie a la derecha.
    const sola = (k) => Array.from({ length: 60 }, (_, i) => (i === k ? '5' : ''));
    const lugares = [];
    for (let k = 0; k < 60; k++) {
      await pagina.evaluate((v) => llenar(v), sola(k));
      lugares.push(await pagina.evaluate(() => {
        const llenas = [...document.querySelectorAll('input')].filter((el) => el.value === '5');
        if (llenas.length !== 1) return null;
        const r = llenas[0].getBoundingClientRect();
        return { x: r.left, y: r.top };
      }));
    }
    for (let k = 0; k < 60; k++) {
      assert.ok(lugares[k], `${archivo}: la ${k + 1} cae en una sola casilla`);
      if (k % 12) assert.ok(lugares[k].y > lugares[k - 1].y, `${archivo}: la ${k + 1} va debajo de la ${k}`);
      else if (k) assert.ok(lugares[k].x > lugares[k - 12].x, `${archivo}: la serie de la ${k + 1} va a la derecha`);
    }
    console.log(`✓ llenar · muestra real ${archivo} (${r.metodo})`);
  }
  if (!muestras.length) console.log('· sin muestras reales (ver pruebas/muestras/LEEME.txt)');

  await navegador.close();
}

(async () => {
  pruebasAnalizar();
  pruebasCedula();
  pruebasCapturas();
  await pruebasLicencia();
  pruebasArchivos();
  await pruebasLlenar();
  console.log('Unitarias: todo bien.');
})().catch((e) => { console.error(e); process.exit(1); });
