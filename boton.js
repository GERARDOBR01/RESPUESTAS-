// Botón flotante en la captura del Raven: llena con un clic usando las respuestas
// guardadas en la extensión. llenar() viene de llenar.js (mismo content script).
// Va dentro de Shadow DOM para que ni la página ni el botón se afecten los estilos.
// Se puede arrastrar (por si tapa algo de la página) y recuerda dónde quedó.
(() => {
  const ID = 'raven-llenar';
  const TOTAL = 60;
  const MARGEN = 8;

  // Tras recargar la extensión, el script viejo sigue en la página pero ya no puede
  // leer las respuestas (chrome.runtime.id queda vacío).
  const vivo = () => {
    try { return Boolean(chrome.runtime?.id); } catch { return false; }
  };

  // Un botón vivo de esta extensión contesta el «ping» marcándose; uno huérfano de
  // una versión anterior no contesta y se reemplaza.
  const previo = document.getElementById(ID);
  if (previo) {
    previo.dispatchEvent(new CustomEvent('raven-llenar:ping'));
    const contesto = previo.dataset.vivo === '1';
    delete previo.dataset.vivo;
    if (contesto) return;
    previo.remove();
  }

  const host = document.createElement('div');
  host.id = ID;
  host.addEventListener('raven-llenar:ping', () => {
    if (vivo()) host.dataset.vivo = '1';
  });
  const raiz = host.attachShadow({ mode: 'open' });
  raiz.innerHTML = `
    <style>
      :host { all: initial; }
      button {
        position: fixed; right: 20px; bottom: 20px; z-index: 2147483647;
        display: flex; align-items: center; gap: 8px;
        max-width: 340px; padding: 10px 16px;
        border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.85);
        background: rgba(255, 255, 255, 0.78);
        backdrop-filter: blur(14px);
        box-shadow: 0 6px 24px rgba(29, 36, 51, 0.18);
        font: 600 14px/1.3 system-ui, "Segoe UI", sans-serif;
        color: #1d2433; text-align: left; cursor: pointer;
        touch-action: none; user-select: none;
        transition: box-shadow 0.12s;
      }
      button:hover { box-shadow: 0 8px 28px rgba(29, 36, 51, 0.26); }
      button.arrastrando { cursor: grabbing; transition: none; }
      button.inactivo { cursor: default; color: #5b6475; font-weight: 500; }
      .punto {
        flex: none; width: 9px; height: 9px; border-radius: 50%;
        background: #e5484d; box-shadow: 0 0 0 3px rgba(229, 72, 77, 0.18);
      }
      .ok { color: #1a7f37; }
      .aviso { color: #9a5b00; }
      .mal { color: #e5484d; }
    </style>
    <button type="button" title="Arrastra para moverlo"><span class="punto"></span><span class="texto"></span></button>`;
  const boton = raiz.querySelector('button');
  const texto = raiz.querySelector('.texto');

  let respuestas = [];
  let mensajeHasta = 0;
  let temporizador = null;

  const llenas = () => respuestas.filter(Boolean).length;

  function pintar() {
    if (Date.now() < mensajeHasta) return;
    const n = llenas();
    boton.className = n ? '' : 'inactivo';
    boton.setAttribute('aria-disabled', String(!n));
    texto.textContent = n ? `Llenar respuestas · ${n}/${TOTAL}` : 'Captura las respuestas en la extensión';
  }

  function mostrar(mensaje, tipo) {
    mensajeHasta = Date.now() + 2500;
    texto.textContent = mensaje;
    boton.className = tipo;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { mensajeHasta = 0; pintar(); }, 2500);
  }

  async function leer() {
    const { respuestas: guardadas } = await chrome.storage.local.get('respuestas');
    respuestas = Array.isArray(guardadas) ? guardadas : [];
    return respuestas;
  }

  async function llenarAhora() {
    // Nunca se llena con lo que había en memoria: si no se pueden leer las respuestas
    // actuales, se avisa.
    if (!vivo()) return mostrar('La extensión se actualizó: recarga la página (F5).', 'mal');
    try {
      await leer();
      if (!llenas()) return pintar();
      const r = llenar(respuestas);
      if (r.error) mostrar(r.error, 'mal');
      else if (r.enBlanco.length) mostrar(`${r.llenadas} llenadas · ${r.enBlanco.length} en blanco`, 'aviso');
      else mostrar(`✓ ${r.llenadas} llenadas — revisa y guarda`, 'ok');
    } catch (e) {
      mostrar('Error al llenar: ' + e.message, 'mal');
    }
  }

  // --- Posición y arrastre ---------------------------------------------------
  let pos = { derecha: 20, abajo: 20 };

  function colocar(derecha, abajo) {
    const r = boton.getBoundingClientRect();
    pos = {
      derecha: Math.round(Math.min(Math.max(derecha, MARGEN), innerWidth - r.width - MARGEN)),
      abajo: Math.round(Math.min(Math.max(abajo, MARGEN), innerHeight - r.height - MARGEN)),
    };
    boton.style.right = pos.derecha + 'px';
    boton.style.bottom = pos.abajo + 'px';
  }

  let arrastre = null;
  let fueArrastre = false;
  boton.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    arrastre = { x: e.clientX, y: e.clientY, inicio: { ...pos }, moviendo: false };
    boton.setPointerCapture(e.pointerId);
  });
  boton.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    const dx = e.clientX - arrastre.x;
    const dy = e.clientY - arrastre.y;
    if (!arrastre.moviendo && Math.hypot(dx, dy) < 5) return;
    arrastre.moviendo = true;
    boton.classList.add('arrastrando');
    colocar(arrastre.inicio.derecha - dx, arrastre.inicio.abajo - dy);
  });
  const soltar = () => {
    if (arrastre?.moviendo) {
      fueArrastre = true;
      boton.classList.remove('arrastrando');
      if (vivo()) chrome.storage.local.set({ posicionBoton: pos }).catch(() => {});
    }
    arrastre = null;
  };
  boton.addEventListener('pointerup', soltar);
  boton.addEventListener('pointercancel', soltar);
  addEventListener('resize', () => colocar(pos.derecha, pos.abajo));

  boton.addEventListener('click', () => {
    if (fueArrastre) { fueArrastre = false; return; }
    llenarAhora();
  });

  // --- Arranque ----------------------------------------------------------------
  try {
    chrome.storage.onChanged.addListener((cambios, area) => {
      if (area !== 'local' || !host.isConnected || !('respuestas' in cambios)) return;
      const nuevas = cambios.respuestas.newValue;
      respuestas = Array.isArray(nuevas) ? nuevas : [];
      pintar();
    });
  } catch { /* sin acceso a storage */ }

  (document.body || document.documentElement).append(host);
  pintar();
  chrome.storage.local.get(['respuestas', 'posicionBoton'])
    .then(({ respuestas: guardadas, posicionBoton }) => {
      respuestas = Array.isArray(guardadas) ? guardadas : [];
      pintar();
      if (posicionBoton) colocar(posicionBoton.derecha, posicionBoton.abajo);
    })
    .catch(() => {});
})();
