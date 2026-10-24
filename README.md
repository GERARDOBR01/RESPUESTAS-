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

## Cómo encuentra las casillas
Primero por la etiqueta «N.-» junto a cada casilla; si no la reconoce, por posición (5 columnas de 12). Después de llenar, comprueba que la página se quedó con cada valor; si alguno no lo aceptó, lo dice. Si en algún momento dice que no reconoció las casillas, copia el HTML de un renglón (clic derecho → Inspeccionar → copiar elemento) para ajustarlo.

## Archivos
- `popup.html/css/js` — la ventana de la extensión (captura de las 60).
- `boton.js` — botón flotante en la página del Raven (content script).
- `llenar.js` — ubica las casillas, escribe y comprueba. Lo usan el popup y el botón.
- `analizar.js` — lee una lista pegada (columna de Excel, comas o espacios).

## Pruebas
Usan Chromium con la extensión cargada de verdad y una página falsa en la URL de PsicoWeb (sin datos reales). Necesitan Node y Playwright (`PLAYWRIGHT_DIR` si no está a la mano) y Chromium (`npx playwright install chromium`, o `CHROMIUM` con la ruta).

```
node pruebas/unitarias.js   # lectura de listas y llenado en 3 acomodos de página
node pruebas/extension.js   # popup, botón, guardado, ↻ de la extensión, arrastre
```

## Licencia
Software propietario de Gerardo Barrera, todos los derechos reservados. Se usa solo con una licencia o suscripción por escrito; ver [LICENSE](LICENSE). No está afiliado a PsicoWeb.
