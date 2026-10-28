// Service worker: el botón de la página le pregunta por la licencia. La firma se
// comprueba aquí (crypto.subtle) porque en una página http el content script no lo tiene.
importScripts('licencia.js');

chrome.runtime.onMessage.addListener((mensaje, _remitente, responder) => {
  if (mensaje?.tipo !== 'licencia') return false;
  licenciaActual()
    .then(responder)
    .catch((e) => responder({ estado: 'error', puedeLlenar: false, error: e.message }));
  return true; // responde después
});

// Al instalar (no al actualizar) se abre la bienvenida: fijar el ícono y activar la licencia.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'bienvenida.html' });
});

// Atajo «llenar» (Alt+Shift+L, cambiable en chrome://extensions/shortcuts): le pide al
// botón de la página que llene, con las mismas comprobaciones que un clic. Si la pestaña no
// tiene el botón (abierta antes de instalar, o ruta en minúsculas) se le pone primero.
async function llenarConAtajo(pestana) {
  if (!pestana) [pestana] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  let url;
  try { url = new URL(pestana?.url || ''); } catch { return false; }
  if (!url.hostname.endsWith('psicoweb.com') || !/\/Raven\/IntroducirRespuestas/i.test(url.pathname)) return false;
  const pedir = () => chrome.tabs.sendMessage(pestana.id, { tipo: 'llenar' });
  try {
    return await pedir();
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: pestana.id }, files: chrome.runtime.getManifest().content_scripts[0].js,
    });
    return pedir();
  }
}

chrome.commands.onCommand.addListener((comando, pestana) => {
  if (comando === 'llenar') llenarConAtajo(pestana).catch(() => {});
});
