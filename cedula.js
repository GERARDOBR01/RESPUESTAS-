// La cédula del candidato viene en la URL de la captura (?cedula=…). Para saber de qué
// candidato son las respuestas guardadas se guarda solo una huella de la cédula, nunca
// la cédula. Es síncrona y no usa crypto.subtle para funcionar también en páginas http.
function cedulaDe(url) {
  try {
    const valor = new URL(url).searchParams.get('cedula');
    return valor && valor.trim() ? valor.trim().toUpperCase() : null;
  } catch {
    return null;
  }
}

// cyrb53: huella de 53 bits, suficiente para distinguir candidatos sin guardar el dato.
function huellaCedula(cedula) {
  const texto = 'raven-llenar:' + String(cedula).trim().toUpperCase();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

// Confirmación por segundo clic: pedir() da true en el primer clic (hay que avisar) y
// false si se repite antes de `ms` (ya confirmó). Lo usan borrar y llenar en otra
// cédula, en el popup y en el botón de la página.
function segundoClic(ms, ahora = Date.now) {
  let hasta = 0;
  const pedir = () => {
    if (ahora() > hasta) {
      hasta = ahora() + ms;
      return true;
    }
    hasta = 0;
    return false;
  };
  pedir.cancelar = () => { hasta = 0; };
  return pedir;
}

if (typeof module !== 'undefined') module.exports = { cedulaDe, huellaCedula, segundoClic };
