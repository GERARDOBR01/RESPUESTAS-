// Se inyecta en la página con chrome.scripting.executeScript, así que debe ser
// autocontenida: nada de variables de fuera.
// Ubica las 60 casillas por su etiqueta «N.-»; si no, por posición en pantalla
// (5 columnas de 12, izquierda→derecha y arriba→abajo). Solo escribe: no aprieta
// ningún botón de la página.
function llenar(respuestas) {
  const TOTAL = 60;
  const ETIQUETA = /^\s*(\d{1,2})\s*\.\s*-?\s*$/;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const campos = [...document.querySelectorAll('input')].filter(
    (el) => ['text', 'number', 'tel'].includes(el.type) && !el.readOnly && !el.disabled && visible(el)
  );
  const enCampos = new Set(campos);
  const cuantosDentro = (nodo) =>
    nodo.querySelectorAll ? [...nodo.querySelectorAll('input')].filter((i) => enCampos.has(i)).length : 0;

  const numeroDe = (el) => {
    for (const lab of el.labels || []) {
      const m = ETIQUETA.exec(lab.textContent);
      if (m) return +m[1];
    }
    // Sube por los contenedores mientras sigan teniendo solo esta casilla, y en
    // cada nivel mira lo que hay justo antes (texto suelto o elemento sin casillas).
    let nodo = el;
    for (let nivel = 0; nivel < 5 && nodo; nivel++) {
      for (let prev = nodo.previousSibling; prev; prev = prev.previousSibling) {
        if (cuantosDentro(prev) > 0) break;
        const texto = (prev.textContent || '').trim();
        if (!texto) continue;
        const m = ETIQUETA.exec(texto);
        if (m) return +m[1];
        break;
      }
      const padre = nodo.parentElement;
      if (!padre || cuantosDentro(padre) > 1) break;
      nodo = padre;
    }
    return null;
  };

  let casillas = null;
  let metodo = null;

  const porNumero = new Map();
  for (const el of campos) {
    const n = numeroDe(el);
    if (n >= 1 && n <= TOTAL && !porNumero.has(n)) porNumero.set(n, el);
  }
  if (porNumero.size === TOTAL) {
    casillas = Array.from({ length: TOTAL }, (_, i) => porNumero.get(i + 1));
    metodo = 'etiqueta';
  } else if (campos.length === TOTAL) {
    const conPos = campos.map((el) => ({ el, r: el.getBoundingClientRect() }));
    conPos.sort((a, b) => a.r.left - b.r.left);
    const columnas = [];
    for (const c of conPos) {
      const ultima = columnas[columnas.length - 1];
      if (ultima && Math.abs(c.r.left - ultima[0].r.left) < c.r.width / 2) ultima.push(c);
      else columnas.push([c]);
    }
    if (columnas.length === 5 && columnas.every((col) => col.length === 12)) {
      casillas = columnas.flatMap((col) => col.sort((a, b) => a.r.top - b.r.top).map((c) => c.el));
      metodo = 'posición';
    }
  }

  if (!casillas) {
    return {
      llenadas: 0,
      enBlanco: [],
      metodo: null,
      error: `No reconocí las 60 casillas (encontré ${campos.length} editables y ${porNumero.size} con número). ` +
        '¿Estás en la página de captura del Raven?',
    };
  }

  const setValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  // Escribe las 60 (las vacías también) para que la página quede igual que la extensión.
  let llenadas = 0;
  const enBlanco = [];
  casillas.forEach((el, i) => {
    const valor = String(respuestas[i] ?? '');
    setValor.call(el, valor);
    for (const tipo of ['input', 'change', 'blur']) {
      el.dispatchEvent(new Event(tipo, { bubbles: tipo !== 'blur' }));
    }
    if (!valor) { enBlanco.push(i + 1); return; }
    // Web Animations no toca el style de la casilla: llenar varias veces no deja rastro.
    el.animate(
      [{ boxShadow: '0 0 0 2px #e5484d' }, { boxShadow: '0 0 0 2px transparent' }],
      { duration: 1500, easing: 'ease-out' }
    );
    llenadas++;
  });

  // Comprueba que la página se quedó con cada valor (si la página lo rechaza o lo
  // reescribe, se avisa en vez de decir «listo»).
  const rechazadas = [];
  casillas.forEach((el, i) => {
    if (el.value !== String(respuestas[i] ?? '')) rechazadas.push(i + 1);
  });
  if (rechazadas.length) {
    return {
      llenadas: llenadas - rechazadas.length,
      enBlanco,
      metodo,
      error: `La página no aceptó ${rechazadas.length === 1 ? 'la' : 'las'} ${rechazadas.slice(0, 8).join(', ')}` +
        `${rechazadas.length > 8 ? '…' : ''}. Revísalas a mano.`,
    };
  }

  return { llenadas, enBlanco, metodo, error: null };
}

if (typeof module !== 'undefined') module.exports = { llenar };
