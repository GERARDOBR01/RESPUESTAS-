// Convierte el texto pegado en la lista de respuestas.
// Varias líneas = una respuesta por renglón; un renglón vacío en medio cuenta
// como respuesta en blanco (así una celda vacía de Excel no recorre las demás).
// Una sola línea = separada por comas, espacios o tabs.
const TOTAL = 60;

function analizar(texto) {
  const limpio = (texto || '').trim();
  if (!limpio) return { respuestas: [], error: 'La lista está vacía.' };

  const lineas = limpio.split(/\r?\n/).map((s) => s.trim());
  const unaPorLinea = lineas.length > 1 && lineas.every((l) => !/[\s,;]/.test(l));
  const respuestas = unaPorLinea
    ? lineas
    : limpio.split(/[\s,;]+/).filter(Boolean);

  return { respuestas: respuestas.slice(0, TOTAL), error: null };
}

if (typeof module !== 'undefined') module.exports = { analizar, TOTAL };
