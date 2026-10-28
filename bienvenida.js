// Página que se abre al instalar (background.js): fijar el ícono, activar la licencia y
// cómo usarla. La activación es la misma del popup (licencia.js).
const $ = (id) => document.getElementById(id);
$('contacto').textContent = 'Soporte: ' + LICENCIA_CONTACTO;

function mostrar(texto, tipo) {
  $('licenciaTexto').textContent = texto;
  $('licenciaTexto').className = tipo;
}

async function revisar() {
  const r = await licenciaActual();
  const activa = r.estado !== 'falta' && r.estado !== 'invalida' && r.estado !== 'vencida';
  $('paso-licencia').classList.toggle('hecho', activa);
  if (r.cliente && activa) mostrar(`Licencia activa: ${r.cliente}, vence el ${fechaLegible(r.vence)}.`, 'ok');
  return r;
}

$('guardarClave').addEventListener('click', async () => {
  const clave = $('clave').value.replace(/\s+/g, '');
  if (!clave) return $('clave').focus();
  const { licencia: anterior } = await chrome.storage.local.get('licencia');
  await chrome.storage.local.set({ licencia: clave });
  const r = await revisar();
  if (r.estado === 'invalida' || r.estado === 'vencida' || r.estado === 'falta') {
    await chrome.storage.local.set({ licencia: anterior ?? null });
    return mostrar(r.estado === 'vencida'
      ? `Esa clave venció el ${fechaLegible(r.vence)}. Pide una nueva.`
      : 'Esa clave no es válida: revisa que la hayas copiado completa.', 'mal');
  }
  $('clave').value = '';
});

revisar().then((r) => { if (!$('paso-licencia').classList.contains('hecho')) $('clave').focus(); return r; });
