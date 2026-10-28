// Emite las claves de licencia. Lo corre solo el titular, en su computadora.
//
//   node herramientas/licencia.js llaves                     crea el par de llaves (una vez)
//   node herramientas/licencia.js emitir "Cliente" 2027-01-31 imprime la clave para ese cliente
//   node herramientas/licencia.js leer <clave>                muestra a quién y hasta cuándo
//
// La llave privada vive en ~/.raven-licencias/privada.pem (o RAVEN_LICENCIAS=<carpeta>),
// NUNCA en el repositorio: quien la tenga puede fabricar licencias. Haz respaldo de esa
// carpeta (USB, gestor de contraseñas): si se pierde, hay que crear llaves nuevas,
// publicar una versión nueva y volver a emitir todas las licencias.
// La llave pública se escribe en licencia.js (esa sí va en la extensión).
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CARPETA = process.env.RAVEN_LICENCIAS || path.join(os.homedir(), '.raven-licencias');
const PRIVADA = path.join(CARPETA, 'privada.pem');
const REGISTRO = path.join(CARPETA, 'emitidas.csv');
const LICENCIA_JS = path.join(__dirname, '..', 'licencia.js');

const base64url = (bytes) => Buffer.from(bytes).toString('base64url');

// Firma {cliente, vence} con la llave privada (objeto KeyObject o PEM).
function firmarClave(privada, cliente, vence, emitida = new Date().toISOString().slice(0, 10)) {
  const datos = { c: cliente, v: vence, e: emitida, n: crypto.randomBytes(4).toString('hex') };
  const firmado = 'RAVEN1.' + base64url(JSON.stringify(datos));
  const firma = crypto.sign('sha256', Buffer.from(firmado), { key: privada, dsaEncoding: 'ieee-p1363' });
  return { clave: `${firmado}.${base64url(firma)}`, datos };
}

function publicaJwk(privada) {
  const { x, y } = crypto.createPublicKey(privada).export({ format: 'jwk' });
  return { x, y };
}

function escribirPublica(jwk, archivo = LICENCIA_JS) {
  const texto = fs.readFileSync(archivo, 'utf8');
  const linea = /^const LICENCIA_PUBLICA = .*;$/m;
  if (!linea.test(texto)) throw new Error('No encontré «const LICENCIA_PUBLICA = …;» en ' + archivo);
  fs.writeFileSync(archivo, texto.replace(linea, `const LICENCIA_PUBLICA = ${JSON.stringify(jwk)};`));
}

function llaves() {
  if (fs.existsSync(PRIVADA)) {
    console.error(`Ya existe ${PRIVADA}. No la reemplazo: las licencias emitidas dejarían de valer.`);
    console.error('Si de verdad quieres llaves nuevas, mueve esa carpeta a otro lado y vuelve a correr esto.');
    process.exit(1);
  }
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.mkdirSync(CARPETA, { recursive: true, mode: 0o700 });
  fs.writeFileSync(PRIVADA, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  escribirPublica(publicaJwk(privateKey));
  console.log(`Llave privada: ${PRIVADA}`);
  console.log('  → Haz respaldo de esa carpeta y no la compartas ni la subas a git.');
  console.log('Llave pública escrita en licencia.js → haz commit y publica una versión nueva.');
}

function emitir(cliente, vence) {
  if (!cliente || !/^\d{4}-\d{2}-\d{2}$/.test(vence || '')) {
    console.error('Uso: node herramientas/licencia.js emitir "Nombre del cliente" AAAA-MM-DD');
    process.exit(1);
  }
  const privada = crypto.createPrivateKey(fs.readFileSync(PRIVADA));
  const { clave, datos } = firmarClave(privada, cliente, vence);
  if (!fs.existsSync(REGISTRO)) fs.writeFileSync(REGISTRO, 'emitida,cliente,vence,folio\n');
  fs.appendFileSync(REGISTRO, `${datos.e},"${cliente.replace(/"/g, '""')}",${vence},${datos.n}\n`);
  console.log(clave);
  console.error(`(registrada en ${REGISTRO})`);
}

async function leer(clave) {
  const { leerClave, verificarLicencia } = require('../licencia.js');
  const leida = leerClave(clave);
  if (!leida) return console.log('No es una clave RAVEN1 válida.');
  let publica = null;
  if (fs.existsSync(PRIVADA)) publica = publicaJwk(crypto.createPrivateKey(fs.readFileSync(PRIVADA)));
  const r = await verificarLicencia(clave, undefined, publica);
  console.log(JSON.stringify({ ...leida.datos, estado: r.estado, dias: r.dias }, null, 2));
}

if (require.main === module) {
  const [orden, ...args] = process.argv.slice(2);
  if (orden === 'llaves') llaves();
  else if (orden === 'emitir') emitir(args[0], args[1]);
  else if (orden === 'leer') leer(args.join(''));
  else {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 6).join('\n').replace(/^\/\/ ?/gm, ''));
  }
}

module.exports = { firmarClave, publicaJwk, escribirPublica };
