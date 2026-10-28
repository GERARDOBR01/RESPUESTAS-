// Cola de candidatos: varias capturas guardadas, cada una ligada (por la huella de su
// cédula, cedula.js) al candidato al que pertenece. Al abrir la captura de un candidato en
// PsicoWeb se usan sus respuestas solas; al llenarla queda marcada como hecha.
//
// Se guarda en chrome.storage.local como { capturas: [captura…], actual: id }, con
// captura = { id, nombre, huella, pista, respuestas[60], creada, llenada }.
// nombre lo escribe el usuario (opcional); pista = últimos 4 caracteres de la cédula, para
// que se reconozca cuál es; la cédula completa nunca se guarda.
// Solo declaraciones de función: el popup puede volver a inyectar este archivo en la
// página, y un const repetido ahí fallaría.

function nuevaCaptura(capturas) {
  let n = capturas.length + 1;
  while (capturas.some((c) => c.nombre === `Candidato ${n}`)) n++;
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nombre: `Candidato ${n}`,
    huella: null,
    pista: null,
    respuestas: Array(60).fill(''),
    creada: Date.now(),
    llenada: null,
  };
}

function pistaDe(cedula) {
  return cedula ? String(cedula).trim().toUpperCase().slice(-4) : null;
}

function llenasDe(captura) {
  return captura ? captura.respuestas.filter(Boolean).length : 0;
}

// Pasa lo guardado por versiones anteriores ({ respuestas, dueno } o el texto pegado
// { lista }) a la cola. Devuelve null si ya está al día.
function migrarCapturas(guardado, analizarLista) {
  if (Array.isArray(guardado.capturas)) return null;
  let respuestas = Array.isArray(guardado.respuestas) ? guardado.respuestas : null;
  if (!respuestas && guardado.lista && analizarLista) respuestas = analizarLista(guardado.lista).respuestas;
  const captura = nuevaCaptura([]);
  if (respuestas) {
    captura.respuestas = Array.from({ length: 60 }, (_, i) => String(respuestas[i] ?? '').replace(/\D/g, '').slice(-1));
  }
  captura.huella = typeof guardado.dueno === 'string' ? guardado.dueno : null;
  return { capturas: [captura], actual: captura.id };
}

// Qué captura usar en una página cuya cédula tiene esta huella.
// motivo: 'cedula' (es la de este candidato), 'libre' (la actual no tiene cédula: se
// liga a esta al llenar), 'otra' (la actual es de otro candidato: pedir confirmación),
// 'actual' (la página no trae cédula) o 'ninguna'.
function elegirCaptura(capturas, actualId, huella) {
  const propia = huella ? capturas.find((c) => c.huella === huella) : null;
  if (propia) return { captura: propia, motivo: 'cedula' };
  const actual = capturas.find((c) => c.id === actualId) || null;
  if (!actual) return { captura: null, motivo: 'ninguna' };
  if (!huella) return { captura: actual, motivo: 'actual' };
  if (!actual.huella) return { captura: actual, motivo: 'libre' };
  return { captura: actual, motivo: 'otra' };
}

// Tras llenar bien en la página: la captura queda ligada a esa cédula y marcada como hecha.
// Si otra captura tenía esa cédula, la suelta (una cédula, una captura).
function marcarLlenada(capturas, id, huella, pista, ahora = Date.now()) {
  return capturas.map((c) => {
    if (c.id === id) {
      return { ...c, llenada: ahora, huella: huella || c.huella, pista: huella ? pista : c.pista };
    }
    if (huella && c.huella === huella) return { ...c, huella: null, pista: null };
    return c;
  });
}

function nombreCorto(captura) {
  return captura.pista ? `${captura.nombre} (…${captura.pista})` : captura.nombre;
}

if (typeof module !== 'undefined') {
  module.exports = { nuevaCaptura, pistaDe, llenasDe, migrarCapturas, elegirCaptura, marcarLlenada, nombreCorto };
}
