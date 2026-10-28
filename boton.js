// Botón flotante en la captura del Raven: llena con un clic usando la captura del
// candidato abierto (por su cédula) o la que esté abierta en la extensión. llenar(),
// cedulaDe(), huellaCedula(), segundoClic() y las funciones de la cola vienen de llenar.js,
// cedula.js y capturas.js (mismo content script). La licencia la comprueba background.js.
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

  let capturas = [];
  let actualId = null;
  let mensajeHasta = 0;
  let temporizador = null;

  // Cédula de esta página (cedula.js): decide qué captura de la cola se usa.
  const cedula = cedulaDe(location.href);
  const huella = cedula ? huellaCedula(cedula) : null;
  const elegida = () => elegirCaptura(capturas, actualId, huella);

  function pintar() {
    if (Date.now() < mensajeHasta) return;
    const { captura, motivo } = elegida();
    const n = llenasDe(captura);
    boton.className = n ? '' : 'inactivo';
    boton.setAttribute('aria-disabled', String(!n));
    if (!n) texto.textContent = 'Captura las respuestas en la extensión';
    else if (motivo !== 'cedula') texto.textContent = `Llenar respuestas · ${n}/${TOTAL}`;
    else texto.textContent = `${captura.llenada ? 'Llenar otra vez' : 'Llenar'} · ${nombreCorto(captura)} · ${n}/${TOTAL}`;
  }

  function mostrar(mensaje, tipo, duracion = 2500) {
    mensajeHasta = Date.now() + duracion;
    texto.textContent = mensaje;
    boton.className = tipo;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { mensajeHasta = 0; pintar(); }, duracion);
  }

  const confirmarOtra = segundoClic(4000);

  function tomar(guardado) {
    // Lo de versiones anteriores ({ respuestas, dueno }) se lee igual; el popup lo convierte.
    const datos = migrarCapturas(guardado) || guardado;
    capturas = Array.isArray(datos.capturas) ? datos.capturas : [];
    actualId = datos.actual ?? null;
  }

  async function leer() {
    tomar(await chrome.storage.local.get(['capturas', 'actual', 'respuestas', 'dueno']));
  }

  async function llenarAhora() {
    // Nunca se llena con lo que había en memoria: si no se pueden leer las respuestas
    // actuales, se avisa.
    if (!vivo()) return mostrar('La extensión se actualizó: recarga la página (F5).', 'mal');
    try {
      await leer();
      const { captura, motivo } = elegida();
      if (!llenasDe(captura)) return pintar();
      const licencia = await chrome.runtime.sendMessage({ tipo: 'licencia' });
      if (!licencia?.puedeLlenar) {
        return mostrar(licencia?.estado === 'vencida'
          ? 'Tu licencia venció · renuévala para seguir llenando'
          : 'Activa tu licencia: abre la extensión', 'mal', 4000);
      }
      if (motivo === 'otra' && confirmarOtra()) {
        return mostrar('Son de otra cédula · clic otra vez para llenar igual', 'aviso', 4000);
      }
      confirmarOtra.cancelar();
      const r = llenar(captura.respuestas);
      if (r.error) return mostrar(r.error, 'mal');
      // Se llenaron en esta cédula: la captura queda ligada a ella y marcada como hecha.
      capturas = marcarLlenada(capturas, captura.id, huella, pistaDe(cedula));
      chrome.storage.local.set({ capturas }).catch(() => {});
      const pendientes = capturas.filter((c) => !c.llenada && llenasDe(c)).length;
      const extra = (pendientes ? ` · faltan ${pendientes}` : '') + (licencia.estado === 'gracia' ? ' · licencia vencida' : '');
      if (r.enBlanco.length) mostrar(`${r.llenadas} llenadas · ${r.enBlanco.length} en blanco${extra}`, 'aviso');
      else mostrar(`✓ ${r.llenadas} llenadas — revisa y guarda${extra}`, 'ok', pendientes ? 3500 : 2500);
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
      if (area !== 'local' || !host.isConnected) return;
      if (!('capturas' in cambios) && !('actual' in cambios)) return;
      if ('capturas' in cambios) capturas = Array.isArray(cambios.capturas.newValue) ? cambios.capturas.newValue : [];
      if ('actual' in cambios) actualId = cambios.actual.newValue ?? null;
      pintar();
    });
  } catch { /* sin acceso a storage */ }

  (document.body || document.documentElement).append(host);
  pintar();
  chrome.storage.local.get(['capturas', 'actual', 'respuestas', 'dueno', 'posicionBoton'])
    .then((guardado) => {
      tomar(guardado);
      pintar();
      if (guardado.posicionBoton) colocar(guardado.posicionBoton.derecha, guardado.posicionBoton.abajo);
    })
    .catch(() => {});
})();
