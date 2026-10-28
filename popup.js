// analizar(), llenar(), cedulaDe(), huellaCedula(), esDeOtraCedula() y segundoClic() vienen
// de analizar.js, llenar.js y cedula.js (cargados antes en popup.html).
const $ = (id) => document.getElementById(id);
const btnLlenar = $('llenar');
const btnBorrar = $('borrar');

let pestana = null;
const casillas = []; // casillas[i] = input de la respuesta i + 1

function armarRejilla() {
  const rejilla = $('rejilla');
  for (const serie of 'ABCDE') {
    const h = document.createElement('div');
    h.className = 'serie';
    h.textContent = serie;
    rejilla.append(h);
  }
  // La rejilla se acomoda por filas: 1, 13, 25, 37, 49, 2, 14…
  for (let fila = 1; fila <= 12; fila++) {
    for (let col = 0; col < 5; col++) {
      const n = col * 12 + fila;
      const celda = document.createElement('div');
      celda.className = 'celda';
      celda.innerHTML = `<label for="r${n}">${n}.-</label><input id="r${n}" inputmode="numeric" autocomplete="off">`;
      rejilla.append(celda);
      casillas[n - 1] = celda.querySelector('input');
    }
  }
  casillas.forEach((input, i) => {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => {
      const digito = input.value.replace(/\D/g, '').slice(-1);
      input.value = digito;
      cambio();
      if (digito) enfocar(i + 1);
    });
    input.addEventListener('keydown', (e) => teclas(e, i));
    input.addEventListener('paste', (e) => pegar(e, i));
  });
}

function enfocar(i) {
  if (i >= 0 && i < TOTAL) casillas[i].focus();
  else if (i >= TOTAL) btnLlenar.focus();
}

function teclas(e, i) {
  const mover = {
    Enter: 1, ArrowDown: 1, ArrowUp: -1, ArrowRight: 12, ArrowLeft: -12,
    Tab: e.shiftKey ? -1 : 1,
  }[e.key];
  if (mover !== undefined) {
    const destino = i + mover;
    if (e.key === 'Tab' && (destino < 0 || destino >= TOTAL)) return; // deja salir a los botones
    e.preventDefault();
    // Enter/↓ en la 60 pasa a «Llenar página»; otro Enter llena.
    if ((destino >= 0 && destino < TOTAL) || (destino === TOTAL && mover === 1)) enfocar(destino);
  } else if (e.key === 'Backspace' && !casillas[i].value && i > 0) {
    e.preventDefault();
    casillas[i - 1].value = '';
    casillas[i - 1].focus();
    cambio();
  }
}

// Pegar una lista (p. ej. la columna de Excel) la reparte desde esta casilla.
function pegar(e, i) {
  const { respuestas } = analizar(e.clipboardData.getData('text'));
  if (!respuestas.length || (respuestas.length === 1 && /^\d$/.test(respuestas[0]))) return;
  e.preventDefault();
  // Solo entra un dígito por casilla; lo demás («10», «a») se deja vacío y se avisa,
  // en vez de recortarlo a un número que no era.
  const raras = [];
  respuestas.slice(0, TOTAL - i).forEach((v, k) => {
    const ok = /^\d?$/.test(v);
    casillas[i + k].value = ok ? v : '';
    if (!ok) raras.push(`${i + k + 1} («${v}»)`);
  });
  cambio();
  if (raras.length) estado(`Quedaron vacías porque no eran un dígito: ${raras.slice(0, 6).join(', ')}${raras.length > 6 ? '…' : ''}.`, 'aviso');
  else if (respuestas.length > TOTAL - i) estado(`Sobraron ${respuestas.length - (TOTAL - i)} valores al final; no se usaron.`, 'aviso');
  else estado('');
  enfocar(Math.min(i + respuestas.length, TOTAL));
}

const valores = () => casillas.map((c) => c.value);

// De qué candidato son las respuestas: huella de la cédula (cedula.js), nunca la cédula.
let dueno = null;          // huella guardada con las respuestas
let huellaPestana = null;  // huella de la cédula abierta en la pestaña
let llenasAntes = 0;
const confirmarOtra = segundoClic(4000);

const esDeOtra = () => esDeOtraCedula(dueno, huellaPestana) && casillas.some((c) => c.value);

function avisoOtra() {
  $('otra').hidden = !esDeOtra();
}

function cambio() {
  const llenas = pintar();
  // Una captura nueva (de 0 a la primera respuesta) queda ligada a la cédula abierta.
  if (llenasAntes === 0 && llenas > 0) dueno = huellaPestana;
  if (llenas === 0) dueno = null;
  llenasAntes = llenas;
  avisoOtra();
  chrome.storage.local.set({ respuestas: valores(), dueno })
    .catch((e) => estado('No se pudo guardar: ' + e.message, 'mal'));
}

function pintar() {
  const llenas = casillas.filter((c) => c.value).length;
  const contador = $('contador');
  contador.textContent = `${llenas} / ${TOTAL}`;
  contador.className = 'contador ' + (llenas === TOTAL ? 'ok' : '');
  return llenas;
}

function estado(texto, tipo = '') {
  const p = $('estado');
  p.textContent = texto;
  p.className = 'estado ' + tipo;
}

async function revisarPestana() {
  [pestana] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pagina = $('pagina');
  let url = null;
  try { url = new URL(pestana?.url || ''); } catch { /* sin permiso para leer la URL */ }

  if (!url || !url.hostname.endsWith('psicoweb.com')) {
    pagina.textContent = 'Puedes capturar aquí; para llenar abre la captura del Raven en PsicoWeb.';
    pagina.className = 'pagina mal';
    btnLlenar.disabled = true;
  } else if (!/\/Raven\/IntroducirRespuestas/i.test(url.pathname)) {
    pagina.textContent = 'Estás en PsicoWeb, pero esta no parece la captura del Raven.';
    pagina.className = 'pagina mal';
  } else {
    pagina.textContent = 'Página de captura del Raven detectada.';
    pagina.className = 'pagina';
    // Si la pestaña ya estaba abierta antes de instalar/recargar la extensión, Chrome no
    // le puso el botón. Se agrega aquí (boton.js no lo duplica si ya existe).
    chrome.scripting.executeScript({ target: { tabId: pestana.id }, files: ['cedula.js', 'llenar.js', 'boton.js'] })
      .catch(() => {});
  }
  if (url && url.hostname.endsWith('psicoweb.com')) {
    const cedula = cedulaDe(url.href);
    huellaPestana = cedula ? huellaCedula(cedula) : null;
  }
  avisoOtra();
}

// Primero la página principal; solo si ahí no están las casillas se busca en sus marcos
// (un iframe ajeno haría fallar la llamada completa si se intentara desde el principio).
async function llenarPestana(respuestas) {
  const correr = async (target) => {
    const marcos = await chrome.scripting.executeScript({ target, func: llenar, args: [respuestas] });
    const resultados = marcos.map((m) => m.result).filter(Boolean);
    return resultados.find((r) => r.metodo) || resultados[0];
  };
  const principal = await correr({ tabId: pestana.id });
  if (principal?.metodo) return principal;
  try {
    const enMarcos = await correr({ tabId: pestana.id, allFrames: true });
    if (enMarcos?.metodo) return enMarcos;
  } catch { /* algún marco sin permiso: se queda el resultado de la principal */ }
  return principal || { error: 'No se pudo llenar la página.' };
}

// Borrar pide un segundo clic para no perder la captura por accidente.
const confirmarBorrar = segundoClic(3000);
btnBorrar.addEventListener('click', async () => {
  if (confirmarBorrar()) {
    btnBorrar.textContent = '¿Seguro? Clic otra vez';
    setTimeout(() => { btnBorrar.textContent = 'Borrar todo'; }, 3000);
    return;
  }
  btnBorrar.textContent = 'Borrar todo';
  await borrarTodo();
});

// «Empezar captura nueva» del aviso de otra cédula: ya es una decisión explícita.
$('nueva').addEventListener('click', () => borrarTodo());

async function borrarTodo() {
  casillas.forEach((c) => { c.value = ''; });
  dueno = null;
  llenasAntes = 0;
  pintar();
  avisoOtra();
  await chrome.storage.local.remove(['respuestas', 'dueno']).catch(() => {});
  estado('');
  casillas[0].focus();
}

btnLlenar.addEventListener('click', async () => {
  const respuestas = valores();
  if (respuestas.every((v) => !v)) return estado('No hay respuestas capturadas.', 'mal');
  if (esDeOtra() && confirmarOtra()) {
    return estado('Estas respuestas se capturaron para otra cédula. Clic otra vez en «Llenar página» para usarlas aquí.', 'aviso');
  }
  confirmarOtra.cancelar();

  btnLlenar.disabled = true;
  try {
    const r = await llenarPestana(respuestas);
    if (!r.error && huellaPestana) {
      // Se llenaron en esta cédula: desde ahora son de este candidato.
      dueno = huellaPestana;
      avisoOtra();
      chrome.storage.local.set({ dueno }).catch(() => {});
    }
    if (r.error) {
      estado(r.error, 'mal');
    } else if (r.enBlanco.length) {
      const lista = r.enBlanco.slice(0, 8).join(', ') + (r.enBlanco.length > 8 ? '…' : '');
      estado(`Llené ${r.llenadas}; en blanco: ${lista}. Revisa y guarda en la página.`, 'aviso');
    } else {
      estado(`Listo: ${r.llenadas} casillas llenadas. Revisa y guarda en la página.`, 'ok');
    }
  } catch (e) {
    estado('Error al llenar: ' + e.message, 'mal');
  } finally {
    btnLlenar.disabled = false;
  }
});

(async () => {
  armarRejilla();
  try {
    let { respuestas, lista, dueno: guardado } = await chrome.storage.local.get(['respuestas', 'lista', 'dueno']);
    dueno = typeof guardado === 'string' ? guardado : null;
    if (!respuestas && lista) {
      // Versión anterior guardaba el texto pegado.
      respuestas = analizar(lista).respuestas;
      await chrome.storage.local.set({ respuestas });
      await chrome.storage.local.remove('lista');
    }
    if (Array.isArray(respuestas)) {
      respuestas.forEach((v, i) => { if (casillas[i]) casillas[i].value = String(v ?? '').replace(/\D/g, '').slice(-1); });
    }
  } catch (e) {
    estado('No se pudieron leer las respuestas guardadas: ' + e.message, 'mal');
  }
  llenasAntes = pintar();
  await revisarPestana();
  const primeraVacia = casillas.findIndex((c) => !c.value);
  enfocar(primeraVacia === -1 ? 0 : primeraVacia);
})();
