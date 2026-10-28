// Licencia: una clave firmada por el titular (ECDSA P-256) que dice a quién se le dio y
// hasta cuándo vale. La extensión solo tiene la llave pública: puede comprobar la firma
// sin internet, pero no fabricar claves. Las claves se emiten con herramientas/licencia.js.
//
// Formato: RAVEN1.<datos en base64url>.<firma en base64url>; datos = {c: cliente,
// v: vence 'AAAA-MM-DD' (incluido), e: emitida, n: folio}.

// La escribe «node herramientas/licencia.js llaves». null = sin configurar (solo para
// desarrollo: empaquetar.ps1 no arma el .zip así).
const LICENCIA_PUBLICA = null;

const LICENCIA_AVISO_DIAS = 7;   // avisa desde 7 días antes de vencer
const LICENCIA_GRACIA_DIAS = 7;  // y sigue llenando 7 días después
const LICENCIA_CONTACTO = 'Gerardo Barrera · 33 2263 4262 · jesusgerardobarrerasolis@gmail.com';

function base64urlABytes(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((texto.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Fecha local 'AAAA-MM-DD' → número de día (para restar fechas sin horas ni husos).
function diaDe(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha || '');
  return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : NaN;
}
function hoyLocal(ahora = new Date()) {
  const d = new Date(ahora);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

// Lee la clave sin comprobar la firma. Tolera espacios y saltos de línea al pegarla.
function leerClave(clave) {
  const limpia = String(clave || '').replace(/\s+/g, '');
  const partes = limpia.split('.');
  if (partes.length !== 3 || partes[0] !== 'RAVEN1') return null;
  try {
    const datos = JSON.parse(new TextDecoder().decode(base64urlABytes(partes[1])));
    if (typeof datos.c !== 'string' || Number.isNaN(diaDe(datos.v))) return null;
    return { limpia, datos, firmado: `${partes[0]}.${partes[1]}`, firma: base64urlABytes(partes[2]) };
  } catch {
    return null;
  }
}

// estado: 'sin-configurar' | 'falta' | 'invalida' | 'vigente' | 'por-vencer' | 'gracia' | 'vencida'
// dias: días que faltan para vencer (negativo si ya venció). hoy: número de día (hoyLocal).
async function verificarLicencia(clave, hoy = hoyLocal(), publica = LICENCIA_PUBLICA) {
  if (!publica) return { estado: 'sin-configurar', puedeLlenar: true };
  if (!clave) return { estado: 'falta', puedeLlenar: false };
  const leida = leerClave(clave);
  if (!leida) return { estado: 'invalida', puedeLlenar: false };
  let buena = false;
  try {
    const llave = await crypto.subtle.importKey(
      'jwk', { kty: 'EC', crv: 'P-256', x: publica.x, y: publica.y, ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    buena = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, llave, leida.firma, new TextEncoder().encode(leida.firmado));
  } catch { /* firma mal formada */ }
  if (!buena) return { estado: 'invalida', puedeLlenar: false };

  const { c: cliente, v: vence } = leida.datos;
  const dias = diaDe(vence) - hoy;
  const estado = dias >= LICENCIA_AVISO_DIAS ? 'vigente'
    : dias >= 0 ? 'por-vencer'
    : dias >= -LICENCIA_GRACIA_DIAS ? 'gracia'
    : 'vencida';
  return { estado, puedeLlenar: estado !== 'vencida', cliente, vence, dias, clave: leida.limpia };
}

// Lee la clave guardada y la verifica. Para que atrasar el reloj de la computadora no
// alargue la licencia, se usa la fecha más reciente que ya se haya visto.
async function licenciaActual(ahora = new Date()) {
  const { licencia, licenciaVista } = await chrome.storage.local.get(['licencia', 'licenciaVista']);
  let hoy = hoyLocal(ahora);
  if (Number.isFinite(licenciaVista) && licenciaVista > hoy) hoy = licenciaVista;
  else if (licenciaVista !== hoy) await chrome.storage.local.set({ licenciaVista: hoy });
  return verificarLicencia(licencia, hoy);
}

// Texto corto para el usuario: «vence el 31 ene 2027».
function fechaLegible(vence) {
  const [a, m, d] = vence.split('-').map(Number);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${meses[m - 1]} ${a}`;
}

if (typeof module !== 'undefined') {
  module.exports = {
    LICENCIA_AVISO_DIAS, LICENCIA_GRACIA_DIAS, leerClave, verificarLicencia, hoyLocal, diaDe, fechaLegible,
  };
}
