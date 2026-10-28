// analizar(), llenar(), cedulaDe(), huellaCedula(), segundoClic(), las funciones de la cola
// (capturas.js) y las de la licencia (licencia.js) vienen de los scripts cargados antes en
// popup.html.
const $ = (id) => document.getElementById(id);
const btnLlenar = $('llenar');
const btnBorrar = $('borrar');
const MAX_CAPTURAS = 100;

let pestana = null;
const casillas = []; // casillas[i] = input de la respuesta i + 1

// Cola de candidatos (capturas.js)
let capturas = [];
let actualId = null;
const actual = () => capturas.find((c) => c.id === actualId);

// Cédula de la pestaña: solo en memoria; se guarda su huella y los últimos 4 caracteres.
let cedulaPestana = null;
let huellaPestana = null;
let enPsicoweb = false;
let licencia = { estado: 'sin-configurar', puedeLlenar: true };
// Doble captura: la rejilla muestra y guarda la 2ª captura (verificacion) en vez de la 1ª.
let verificando = false;

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
  else if (i >= TOTAL) (verificando ? $('verificar') : btnLlenar).focus();
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

function guardar() {
  return chrome.storage.local.set({ capturas, actual: actualId })
    .catch((e) => estado('No se pudo guardar: ' + e.message, 'mal'));
}

const ligadaA = (huella, sinContar) => capturas.find((c) => c.huella === huella && c !== sinContar);

// Una tecla en la rejilla: se guarda la captura. Si empieza (de 0 a la primera respuesta)
// sin cédula y la pestaña tiene una que no es de otra captura, queda ligada a ella.
function cambio() {
  const c = actual();
  if (verificando) {
    c.verificacion = valores();
    pintar();
    guardar();
    return;
  }
  const antes = llenasDe(c);
  const nuevas = valores();
  // Corregir a mano una casilla ya verificada es la decisión final (p. ej. al resolver
  // una diferencia con la hoja): la 2ª captura toma el mismo valor.
  if (c.verificacion) {
    nuevas.forEach((v, i) => { if (v !== c.respuestas[i] && c.verificacion[i]) c.verificacion[i] = v; });
  }
  c.respuestas = nuevas;
  c.llenada = null; // cambió: hay que volver a llenar
  if (antes === 0 && llenasDe(c) > 0 && !c.huella && huellaPestana && !ligadaA(huellaPestana, c)) {
    c.huella = huellaPestana;
    c.pista = pistaDe(cedulaPestana);
  }
  pintar();
  guardar();
}

function pintar() {
  const c = actual();
  const llenas = llenasDe(c);
  const contador = $('contador');
  const ver = c.verificacion;
  if (verificando) {
    const tecleadas = (ver || []).filter(Boolean).length;
    contador.textContent = `2ª: ${tecleadas} / ${llenas}`;
    contador.className = 'contador ' + (diferencias(c).length ? 'mal' : tecleadas >= llenas ? 'ok' : '');
  } else {
    contador.textContent = `${llenas} / ${TOTAL}`;
    contador.className = 'contador ' + (llenas === TOTAL ? 'ok' : '');
  }
  // Diferencias de la doble captura: en rojo. Al verificar no se muestra la 1ª (sería copiarla).
  casillas.forEach((input, i) => {
    const difiere = Boolean(ver && ver[i] && ver[i] !== c.respuestas[i]);
    input.classList.toggle('difiere', difiere);
    input.title = difiere && !verificando ? `1ª captura: ${c.respuestas[i] || 'vacía'} · 2ª: ${ver[i]}` : '';
    // Al resolver se ve la 2ª junto a la casilla, para compararla con la hoja.
    if (difiere && !verificando) input.parentElement.dataset.segunda = ver[i];
    else delete input.parentElement.dataset.segunda;
  });
  document.body.classList.toggle('verificando', verificando);
  $('modoVerificar').hidden = !verificando;
  $('verificar').textContent = verificando ? 'Terminar verificación' : 'Verificar';
  $('verificar').disabled = !verificando && !llenas;
  btnBorrar.disabled = verificando;

  const lista = $('capturas');
  lista.replaceChildren(...capturas.map((k) => {
    const op = document.createElement('option');
    op.value = k.id;
    const dif = diferencias(k).length;
    const verificada = estadoVerificacion(k) === 'verificada' ? ' · verificada' : '';
    op.textContent = `${nombreCorto(k)} · ${llenasDe(k)}/60${dif ? ` · ${dif} ${dif === 1 ? 'diferencia' : 'diferencias'}` : verificada}${k.llenada ? ' · ✓ llenada' : ''}`;
    return op;
  }));
  lista.value = actualId;

  if (document.activeElement !== $('nombre')) $('nombre').value = c.nombre;
  const cedula = $('cedula');
  cedula.placeholder = c.huella ? `✓ …${c.pista || ''}` : (huellaPestana ? 'la de la página' : 'escríbela');
  cedula.title = c.huella ? 'Ligada. Escribe otra cédula para cambiarla.' : '';

  const { motivo } = elegirCaptura([c], c.id, huellaPestana);
  const otra = motivo === 'otra' && llenas > 0;
  $('otra').hidden = !otra;
  if (otra) {
    // Si el candidato de la página ya está en la cola, se ofrece ir a su captura.
    const suya = ligadaA(huellaPestana);
    $('otraTexto').textContent = `Esta captura es de ${nombreCorto(c)}; la página es de otro candidato.`;
    $('nuevaAqui').textContent = suya ? `Ir a ${nombreCorto(suya)}` : 'Nueva captura para esta cédula';
  }

  const llenadas = capturas.filter((k) => k.llenada).length;
  $('quitarLlenadas').hidden = !llenadas;
  $('quitarLlenadas').textContent = `Quitar llenadas (${llenadas})`;
  btnLlenar.disabled = verificando || !enPsicoweb || !licencia.puedeLlenar;
  return llenas;
}

function mostrarCaptura(id) {
  if (id !== actualId) verificando = false;
  actualId = id;
  const c = actual();
  const fuente = verificando ? (c.verificacion || []) : c.respuestas;
  casillas.forEach((input, i) => { input.value = fuente[i] || ''; });
  confirmarOtra.cancelar();
  pintar();
}

function estado(texto, tipo = '') {
  const p = $('estado');
  p.textContent = texto;
  p.className = 'estado ' + tipo;
}

// --- Cola ----------------------------------------------------------------------
$('capturas').addEventListener('change', (e) => {
  mostrarCaptura(e.target.value);
  guardar();
  estado('');
  const vacia = casillas.findIndex((c) => !c.value);
  enfocar(vacia === -1 ? 0 : vacia);
});

function agregarCaptura({ ligarPestana }) {
  if (capturas.length >= MAX_CAPTURAS) {
    estado(`Ya hay ${MAX_CAPTURAS} capturas. Quita las llenadas o borra alguna.`, 'mal');
    return;
  }
  const c = nuevaCaptura(capturas);
  if (ligarPestana && huellaPestana && !ligadaA(huellaPestana)) {
    c.huella = huellaPestana;
    c.pista = pistaDe(cedulaPestana);
  }
  capturas.push(c);
  mostrarCaptura(c.id);
  guardar();
  estado('');
  casillas[0].focus();
}
$('nueva').addEventListener('click', () => agregarCaptura({ ligarPestana: true }));
// Del aviso de otra cédula: la captura del candidato abierto, o una nueva para él.
$('nuevaAqui').addEventListener('click', () => {
  const suya = ligadaA(huellaPestana);
  if (!suya) return agregarCaptura({ ligarPestana: true });
  mostrarCaptura(suya.id);
  guardar();
  estado('');
});

$('nombre').addEventListener('input', (e) => {
  actual().nombre = e.target.value.trim() || 'Sin nombre';
  pintar();
  guardar();
});
$('nombre').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('cedula').focus(); });

// Escribir la cédula a mano (capturas de un grupo antes de abrirlas en PsicoWeb).
function ligarCedula() {
  const input = $('cedula');
  const cedula = input.value.trim().toUpperCase();
  if (!cedula) return;
  const huella = huellaCedula(cedula);
  const otra = ligadaA(huella, actual());
  if (otra) {
    estado(`Esa cédula ya está en «${nombreCorto(otra)}».`, 'mal');
    input.select();
    return;
  }
  const c = actual();
  c.huella = huella;
  c.pista = pistaDe(cedula);
  input.value = '';
  pintar();
  guardar();
  estado(`Ligada a la cédula …${c.pista}.`, 'ok');
}
$('cedula').addEventListener('change', ligarCedula);
$('cedula').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  ligarCedula();
  const vacia = casillas.findIndex((c) => !c.value);
  enfocar(vacia === -1 ? 0 : vacia);
});

// Borrar la captura abierta pide un segundo clic para no perderla por accidente.
const confirmarBorrar = segundoClic(3000);
btnBorrar.addEventListener('click', () => {
  if (confirmarBorrar()) {
    btnBorrar.textContent = '¿Seguro? Clic otra vez';
    setTimeout(() => { btnBorrar.textContent = 'Borrar captura'; }, 3000);
    return;
  }
  btnBorrar.textContent = 'Borrar captura';
  quitar((c) => c.id === actualId);
});

const confirmarQuitar = segundoClic(3000);
$('quitarLlenadas').addEventListener('click', () => {
  if (confirmarQuitar()) {
    estado('Se quitan las capturas ya llenadas en PsicoWeb. Clic otra vez para confirmar.', 'aviso');
    return;
  }
  quitar((c) => c.llenada);
});

function quitar(condicion) {
  const indice = capturas.findIndex((c) => c.id === actualId);
  capturas = capturas.filter((c) => !condicion(c));
  if (!capturas.length) capturas.push(nuevaCaptura([]));
  const siguiente = capturas.find((c) => c.id === actualId) ||
    capturas.find((c) => !c.llenada && llenasDe(c)) ||
    capturas[Math.min(indice, capturas.length - 1)];
  mostrarCaptura(siguiente.id);
  guardar();
  estado('');
  casillas[0].focus();
}

// --- Doble captura -----------------------------------------------------------------
$('verificar').addEventListener('click', () => {
  const c = actual();
  if (!verificando) {
    verificando = true;
    if (!c.verificacion) c.verificacion = Array(TOTAL).fill('');
    mostrarCaptura(c.id);
    estado('');
    const vacia = c.respuestas.findIndex((r, i) => r && !c.verificacion[i]);
    return enfocar(vacia === -1 ? 0 : vacia);
  }
  verificando = false;
  mostrarCaptura(c.id);
  guardar();
  resumenVerificacion();
});

$('reiniciarVerificacion').addEventListener('click', () => {
  const c = actual();
  c.verificacion = Array(TOTAL).fill('');
  mostrarCaptura(c.id);
  guardar();
  casillas[0].focus();
});

function resumenVerificacion() {
  const c = actual();
  const dif = diferencias(c);
  const faltan = sinVerificar(c);
  const lista = (ns) => ns.slice(0, 10).join(', ') + (ns.length > 10 ? '…' : '');
  if (dif.length) {
    estado(`${dif.length === 1 ? 'Diferencia en la' : `Diferencias en ${dif.length}:`} ${lista(dif)}. ` +
      'Revisa la hoja y escribe el valor correcto en cada casilla roja.', 'mal');
    casillas[dif[0] - 1].focus();
  } else if (faltan.length) {
    estado(`Sin diferencias en lo verificado; faltan ${faltan.length} por volver a teclear (${lista(faltan)}).`, 'aviso');
  } else {
    estado(`✓ Verificada: las ${llenasDe(c)} coinciden.`, 'ok');
  }
}

// --- Pestaña ---------------------------------------------------------------------
async function revisarPestana() {
  [pestana] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pagina = $('pagina');
  let url = null;
  try { url = new URL(pestana?.url || ''); } catch { /* sin permiso para leer la URL */ }

  enPsicoweb = Boolean(url && url.hostname.endsWith('psicoweb.com'));
  if (!enPsicoweb) {
    pagina.textContent = 'Puedes capturar aquí; para llenar abre la captura del Raven en PsicoWeb.';
    pagina.className = 'pagina mal';
  } else if (!/\/Raven\/IntroducirRespuestas/i.test(url.pathname)) {
    pagina.textContent = 'Estás en PsicoWeb, pero esta no parece la captura del Raven.';
    pagina.className = 'pagina mal';
  } else {
    pagina.textContent = 'Página de captura del Raven detectada.';
    pagina.className = 'pagina';
    // Si la pestaña ya estaba abierta antes de instalar/recargar la extensión, Chrome no
    // le puso el botón. Se agrega aquí (boton.js no lo duplica si ya existe).
    chrome.scripting.executeScript({ target: { tabId: pestana.id }, files: chrome.runtime.getManifest().content_scripts[0].js })
      .catch(() => {});
  }
  // PsicoWeb también contesta por http: ahí las respuestas viajan sin cifrar.
  if (enPsicoweb && url.protocol === 'http:') {
    pagina.textContent = 'Conexión sin cifrar (http): las respuestas viajan sin protección.';
    pagina.className = 'pagina mal';
    $('https').hidden = false;
    $('https').onclick = () => {
      url.protocol = 'https:';
      chrome.tabs.update(pestana.id, { url: url.href });
      window.close();
    };
  }
  if (enPsicoweb) {
    cedulaPestana = cedulaDe(url.href);
    huellaPestana = cedulaPestana ? huellaCedula(cedulaPestana) : null;
  }
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

const confirmarOtra = segundoClic(4000);
const confirmarDiferencias = segundoClic(4000);

btnLlenar.addEventListener('click', async () => {
  const c = actual();
  if (!llenasDe(c)) return estado('No hay respuestas capturadas.', 'mal');
  licencia = await licenciaActual();
  pintarLicencia();
  if (!licencia.puedeLlenar) return estado('Sin licencia vigente no se puede llenar.', 'mal');
  const { motivo } = elegirCaptura([c], c.id, huellaPestana);
  if (motivo === 'otra' && confirmarOtra()) {
    return estado('Estas respuestas se capturaron para otra cédula. Clic otra vez en «Llenar página» para usarlas aquí.', 'aviso');
  }
  confirmarOtra.cancelar();
  const dif = diferencias(c);
  if (dif.length && confirmarDiferencias()) {
    return estado(`La doble captura tiene ${dif.length} ${dif.length === 1 ? 'diferencia' : 'diferencias'} sin resolver (${dif.slice(0, 8).join(', ')}). ` +
      'Clic otra vez en «Llenar página» para llenar con la 1ª captura.', 'aviso');
  }
  confirmarDiferencias.cancelar();

  btnLlenar.disabled = true;
  try {
    const r = await llenarPestana(c.respuestas);
    if (r.error) return estado(r.error, 'mal');
    // Se llenaron en esta cédula: la captura queda ligada a ella y marcada como hecha.
    capturas = marcarLlenada(capturas, c.id, huellaPestana, pistaDe(cedulaPestana));
    guardar();
    const pendientes = capturas.filter((k) => !k.llenada && llenasDe(k)).length;
    const cola = pendientes ? ` Faltan ${pendientes} en la cola.` : '';
    const vencida = licencia.estado === 'gracia' ? ' Tu licencia venció: renuévala.' : '';
    if (r.enBlanco.length) {
      const lista = r.enBlanco.slice(0, 8).join(', ') + (r.enBlanco.length > 8 ? '…' : '');
      estado(`Llené ${r.llenadas}; en blanco: ${lista}. Revisa y guarda en la página.${cola}${vencida}`, 'aviso');
    } else {
      estado(`Listo: ${r.llenadas} casillas llenadas. Revisa y guarda en la página.${cola}${vencida}`, 'ok');
    }
  } catch (e) {
    estado('Error al llenar: ' + e.message, 'mal');
  } finally {
    pintar();
  }
});

// --- Licencia (licencia.js) ----------------------------------------------------------
function pintarLicencia() {
  const { estado: e, cliente, vence, dias } = licencia;
  const panel = $('licencia');
  const texto = $('licenciaTexto');
  const fecha = vence ? fechaLegible(vence) : '';
  const mensajes = {
    falta: ['Activa la extensión con la clave de licencia que te dieron.', ''],
    invalida: ['La clave de licencia guardada no es válida. Pega la clave correcta.', 'mal'],
    'por-vencer': [`Tu licencia vence el ${fecha} (${dias === 0 ? 'hoy' : `en ${dias} ${dias === 1 ? 'día' : 'días'}`}). Para renovarla: ${LICENCIA_CONTACTO}`, 'aviso'],
    gracia: [`Tu licencia venció el ${fecha}. Seguirá llenando ${LICENCIA_GRACIA_DIAS + dias} ${LICENCIA_GRACIA_DIAS + dias === 1 ? 'día' : 'días'} más. Para renovarla: ${LICENCIA_CONTACTO}`, 'mal'],
    vencida: [`Tu licencia venció el ${fecha}. Ya no se puede llenar; puedes seguir capturando. Para renovarla: ${LICENCIA_CONTACTO}`, 'mal'],
  };
  const aviso = mensajes[e];
  panel.hidden = !aviso;
  if (aviso) {
    texto.textContent = aviso[0];
    panel.className = 'licencia ' + aviso[1];
  }
  $('activar').hidden = !aviso || e === 'por-vencer';
  $('licenciaPie').textContent = cliente && (e === 'vigente' || e === 'por-vencer')
    ? `Licencia: ${cliente} · vence el ${fecha}` : '';
  $('cambiarClave').hidden = !cliente || !$('activar').hidden;
  pintar();
}

$('cambiarClave').addEventListener('click', () => {
  $('licencia').hidden = false;
  $('licenciaTexto').textContent = 'Pega la clave nueva.';
  $('licencia').className = 'licencia';
  $('activar').hidden = false;
  $('cambiarClave').hidden = true;
  $('clave').focus();
});

$('guardarClave').addEventListener('click', async () => {
  const clave = $('clave').value;
  if (!clave.trim()) return $('clave').focus();
  const { licencia: anterior } = await chrome.storage.local.get('licencia');
  await chrome.storage.local.set({ licencia: clave.replace(/\s+/g, '') });
  const r = await licenciaActual();
  if (r.estado === 'invalida' || r.estado === 'vencida' || r.estado === 'falta') {
    await chrome.storage.local.set({ licencia: anterior ?? null });
    const motivo = r.estado === 'vencida' ? `Esa clave venció el ${fechaLegible(r.vence)}.` : 'Esa clave no es válida: revisa que esté completa.';
    $('licenciaTexto').textContent = motivo;
    $('licencia').className = 'licencia mal';
    return;
  }
  licencia = r;
  $('clave').value = '';
  pintarLicencia();
  estado(`Licencia activada: ${r.cliente}, vence el ${fechaLegible(r.vence)}.`, 'ok');
});

// --- Arranque ----------------------------------------------------------------------
(async () => {
  armarRejilla();
  try {
    const guardado = await chrome.storage.local.get(['capturas', 'actual', 'respuestas', 'dueno', 'lista']);
    const migrado = migrarCapturas(guardado, analizar);
    if (migrado) {
      // Versiones anteriores guardaban una sola captura ({ respuestas, dueno }).
      ({ capturas, actual: actualId } = migrado);
      await chrome.storage.local.set(migrado);
      await chrome.storage.local.remove(['respuestas', 'dueno', 'lista']);
    } else {
      capturas = guardado.capturas;
      actualId = guardado.actual;
    }
  } catch (e) {
    estado('No se pudieron leer las respuestas guardadas: ' + e.message, 'mal');
  }
  if (!capturas.length) capturas.push(nuevaCaptura([]));
  if (!actual()) actualId = capturas[capturas.length - 1].id;

  await revisarPestana();
  // Abierta en la captura de un candidato de la cola: se muestran sus respuestas.
  const propia = huellaPestana && capturas.find((c) => c.huella === huellaPestana);
  if (propia && propia.id !== actualId) {
    actualId = propia.id;
    guardar();
  }
  mostrarCaptura(actualId);
  if (propia) estado(`Respuestas de «${nombreCorto(propia)}» para esta cédula.`);

  // El atajo lo puede cambiar el usuario en chrome://extensions/shortcuts
  chrome.commands.getAll().then((comandos) => {
    const atajo = comandos.find((k) => k.name === 'llenar')?.shortcut;
    if (!atajo) return;
    const tecla = document.createElement('kbd');
    tecla.textContent = atajo;
    $('atajo').replaceChildren('Atajo para llenar desde la página: ', tecla, '.');
  }).catch(() => {});

  try { licencia = await licenciaActual(); } catch (e) { licencia = { estado: 'invalida', puedeLlenar: false }; }
  pintarLicencia();
  document.documentElement.dataset.listo = 'si'; // para las pruebas
  if (licencia.estado === 'falta') return $('clave').focus();
  const primeraVacia = casillas.findIndex((c) => !c.value);
  enfocar(primeraVacia === -1 ? 0 : primeraVacia);
})();
