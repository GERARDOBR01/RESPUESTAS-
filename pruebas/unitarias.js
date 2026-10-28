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

  const { esDeOtraCedula, segundoClic } = require('../cedula.js');
  assert.equal(esDeOtraCedula('a1', 'b2'), true, 'huellas distintas');
  assert.equal(esDeOtraCedula('a1', 'a1'), false, 'misma huella');
  assert.equal(esDeOtraCedula(null, 'a1'), false, 'sin dueño no se sabe');
  assert.equal(esDeOtraCedula('a1', null), false, 'sin cédula en la URL no se sabe');
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
  console.log('✓ cédula: otra cédula y segundo clic');
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
  await pruebasLlenar();
  console.log('Unitarias: todo bien.');
})().catch((e) => { console.error(e); process.exit(1); });
