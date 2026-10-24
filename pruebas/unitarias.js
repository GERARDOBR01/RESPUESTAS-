// Pruebas de analizar() y llenar() sobre páginas falsas en Chromium real.
// Uso: node pruebas/unitarias.js
const assert = require('assert');
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

  await navegador.close();
}

(async () => {
  pruebasAnalizar();
  await pruebasLlenar();
  console.log('Unitarias: todo bien.');
})().catch((e) => { console.error(e); process.exit(1); });
