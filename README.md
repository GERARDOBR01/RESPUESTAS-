# Raven · llenar respuestas

Extensión de Chrome para la página de captura del Raven en PsicoWeb (`/Raven/IntroducirRespuestas`). Capturas las 60 respuestas una vez en la extensión y las escribe en las casillas 1–60 cuantas veces la uses. **Solo llena:** tú revisas y aprietas guardar en la página.

## Instalar
1. `chrome://extensions` → activa **Modo de desarrollador** (arriba a la derecha).
2. **Cargar descomprimida** → elige esta carpeta.
3. Fija el ícono en la barra (pieza de rompecabezas → chincheta).

## Usar
1. Clic en la extensión: aparecen las 60 casillas (A–E, 12 por columna, igual que la página).
2. Captura una por una: escribes el número y salta sola a la siguiente. Se guarda al momento.
   - Enter / ↓ siguiente, ↑ anterior, → / ← brinca de serie (±12), Backspace en vacía regresa.
   - También puedes pegar una columna de Excel en cualquier casilla y se reparte desde ahí.
   - Acepta cualquier dígito; las letras no entran.
   - Enter en la 60 pasa a **Llenar página**; otro Enter llena.
3. En la captura del Raven en PsicoWeb aprieta el botón flotante **Llenar respuestas** (abajo a la derecha) o **Llenar página** en la extensión. Luego revisa y guarda en la página.

Los datos se quedan en la extensión: la próxima vez solo aprietas **Llenar respuestas** en la página. El botón muestra cuántas hay capturadas y se actualiza solo si las cambias. Si tapa algo de la página, arrástralo: recuerda dónde lo dejaste. **Borrar todo** pide un segundo clic. No guarda nada del candidato.

Para actualizar la extensión usa siempre ↻ en `chrome://extensions` (no «Quitar»: eso borra las respuestas guardadas). Después de ↻, el botón que ya estaba en la página avisa «recarga la página» en vez de llenar; abrir la extensión o recargar la página lo pone al día.

## Aviso por cédula
Las respuestas quedan ligadas al candidato: se guarda una huella de la cédula de la URL (`cedula.js`), nunca la cédula. Una captura nueva toma la cédula abierta al teclear la primera respuesta, y llenar en una cédula pasa las respuestas a esa cédula. Si la pestaña es de otra cédula, el popup muestra un aviso con «Empezar captura nueva», y tanto «Llenar página» como el botón de la página piden un segundo clic.

## Cómo encuentra las casillas
Primero por la etiqueta «N.-» junto a cada casilla; si no la reconoce, por posición (5 columnas de 12). Después de llenar, comprueba que la página se quedó con cada valor; si alguno no lo aceptó, lo dice. Si en algún momento dice que no reconoció las casillas, copia el HTML de un renglón (clic derecho → Inspeccionar → copiar elemento) para ajustarlo.

## Archivos
- `popup.html/css/js` — la ventana de la extensión (captura de las 60).
- `boton.js` — botón flotante en la página del Raven (content script).
- `llenar.js` — ubica las casillas, escribe y comprueba. Lo usan el popup y el botón.
- `cedula.js` — lee la cédula de la URL y calcula su huella.
- `analizar.js` — lee una lista pegada (columna de Excel, comas o espacios).
- `marca/logo.svg` — logo original (matriz 2×2 con la pieza que falta en rojo). `node marca/generar-iconos.js` regenera `iconos/icono-{16,32,48,128}.png`.

## Entregar a un cliente
`powershell -ExecutionPolicy Bypass -File herramientas\empaquetar.ps1` arma `dist\raven-llenar-respuestas-v<versión>.zip`, que contiene solo lo que usa Chrome, la guía `INSTALAR.txt` y la `LICENSE`. Para probar esa copia tal cual: descomprímela y corre `EXTENSION_DIR=<carpeta> node pruebas/extension.js`.

## Pruebas
Usan Chromium con la extensión cargada de verdad y una página falsa en la URL de PsicoWeb (sin datos reales). Necesitan Node y Playwright (`PLAYWRIGHT_DIR` si no está a la mano) y Chromium (`npx playwright install chromium`, o `CHROMIUM` con la ruta).

```
node pruebas/unitarias.js   # lectura de listas y llenado en 3 acomodos de página
node pruebas/extension.js   # popup, botón, guardado, ↻ de la extensión, arrastre
```

## Licencia
Software propietario de Gerardo Barrera, todos los derechos reservados. Se usa solo con una licencia o suscripción por escrito; ver [LICENSE](LICENSE). No está afiliado a PsicoWeb.
