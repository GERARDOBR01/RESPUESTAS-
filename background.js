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
