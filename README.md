# Raven · llenar respuestas

Extensión de Chrome para la página de captura del Raven en PsicoWeb (`/Raven/IntroducirRespuestas`). Capturas las 60 respuestas en la extensión y las escribe en las casillas 1–60. Para aplicaciones en grupo guarda una cola de candidatos, cada uno con su cédula. **Solo llena:** tú revisas y aprietas guardar en la página.

## Instalar (desarrollo)
1. `chrome://extensions` → activa **Modo de desarrollador** (arriba a la derecha).
2. **Cargar descomprimida** → elige esta carpeta. Se abre la bienvenida (`bienvenida.html`).
3. Fija el ícono en la barra (pieza de rompecabezas → chincheta).

Mientras `licencia.js` no tenga llave pública (`LICENCIA_PUBLICA = null`) la extensión no pide licencia; ver [Licencias](#licencias).

## Usar
1. Clic en la extensión: aparecen las 60 casillas (A–E, 12 por columna, igual que la página).
2. Captura una por una: escribes el número y salta sola a la siguiente. Se guarda al momento.
   - Enter / ↓ siguiente, ↑ anterior, → / ← brinca de serie (±12), Backspace en vacía regresa.
   - También puedes pegar una columna de Excel en cualquier casilla y se reparte desde ahí.
   - Acepta cualquier dígito; las letras no entran.
   - Enter en la 60 pasa a **Llenar página**; otro Enter llena.
3. En la captura del Raven en PsicoWeb aprieta el botón flotante **Llenar** (abajo a la derecha), **Llenar página** en la extensión o el atajo **Alt+Shift+L**. Luego revisa y guarda en la página.

**Atajos** (se cambian en `chrome://extensions/shortcuts`): **Alt+Shift+L** llena la página igual que el botón, con las mismas comprobaciones (licencia, otra cédula, diferencias); si la pestaña no tiene el botón se lo pone primero. **Alt+Shift+R** abre la extensión. El popup muestra el atajo que esté asignado.

El botón de la página muestra de quién son las respuestas y cuántas hay, y se actualiza solo. Si tapa algo de la página, arrástralo: recuerda dónde lo dejaste.

Para actualizar la extensión usa siempre ↻ en `chrome://extensions` (no «Quitar»: eso borra las capturas y la licencia). Después de ↻, el botón que ya estaba en la página avisa «recarga la página» en vez de llenar; abrir la extensión o recargar la página lo pone al día.

## Cola de candidatos
Para aplicaciones en grupo (`capturas.js`):
1. **+ Nueva** por cada hoja de respuestas; nombre opcional y la **cédula** (Enter liga la captura y pasa a la casilla 1).
2. Al abrir en PsicoWeb la captura de un candidato, el botón de la página y el popup usan sus respuestas solos. Al llenar queda **✓ llenada** y el aviso dice cuántos faltan.
3. **Quitar llenadas** (dos clics) limpia la cola. **Borrar captura** (dos clics) quita la abierta.

Si la captura no tiene cédula, toma la de la pestaña al teclear la primera respuesta, o al llenar. Una cédula solo puede estar en una captura. Si la abierta es de otro candidato, el popup lo avisa y ofrece ir a la captura de ese candidato (o crear una), y llenar pide un segundo clic.

**Qué se guarda:** de la cédula, una huella cyrb53 (`cedula.js`) y sus últimos 4 caracteres para reconocerla; nunca la cédula completa. La huella es un seudónimo, no anonimato: quien conozca el nombre del candidato podría probar cédulas hasta dar con ella. Todo se queda en `chrome.storage.local` de esa computadora.

## Doble captura
Para encontrar errores de dedo antes de llenar: **Verificar** y volver a teclear las 60 de la hoja. La rejilla queda vacía para no copiar la primera. Las casillas que no coinciden se marcan en rojo al momento, sin mostrar qué tenía la primera.
- Al **Terminar verificación** dice cuáles difieren y lleva a la primera. Cada casilla roja muestra el valor de la 2ª captura; se escribe el correcto según la hoja y queda resuelta.
- Mientras haya diferencias, llenar (popup, botón o atajo) pide un segundo clic y usa la 1ª captura.
- La lista marca cada captura como «verificada» o con «N diferencias». **Empezar de nuevo** borra solo la 2ª captura.

## Licencias
La extensión pide una clave `RAVEN1.…` firmada con ECDSA P-256 (`licencia.js`). Solo trae la llave pública: comprueba la firma sin internet, pero no puede fabricar claves.
- Avisa 7 días antes de vencer, sigue llenando 7 días de gracia y después solo deja capturar.
- Atrasar el reloj no la revive: cuenta la fecha más reciente que ya vio.
- El botón de la página la consulta al service worker (`background.js`), porque en una página http el content script no tiene `crypto.subtle`.

Para el titular:
```
node herramientas/licencia.js llaves                      # una vez: crea las llaves
node herramientas/licencia.js emitir "Clínica X" 2027-01-31  # imprime la clave para ese cliente
node herramientas/licencia.js leer RAVEN1.…                # a quién y hasta cuándo
```
La llave privada queda en `~/.raven-licencias/privada.pem` (o `RAVEN_LICENCIAS=<carpeta>`) y cada clave emitida se anota en `emitidas.csv` de esa carpeta. **Haz respaldo de esa carpeta y no la subas a git:** con ella cualquiera emite licencias, y si se pierde hay que crear llaves nuevas y volver a emitirlas todas. Conviene emitir licencias de 1–3 meses, porque una clave no se puede revocar antes de que venza.

Esto sube el costo de copiar la extensión, pero no lo impide: el código está en la computadora del cliente y quien sepa puede quitar la comprobación. La protección de fondo sigue siendo la [LICENSE](LICENSE).

## Cómo encuentra las casillas
Primero por la etiqueta «N.-» junto a cada casilla; si no la reconoce, por posición (5 columnas de 12). Después de llenar, comprueba que la página se quedó con cada valor; si alguno no lo aceptó, lo dice. Si en algún momento dice que no reconoció las casillas, guarda la página en `pruebas/muestras/` (ver `LEEME.txt` ahí) para ajustarlo.

PsicoWeb también contesta por `http://`. Ahí las respuestas viajarían sin cifrar, así que el popup lo avisa y ofrece **Abrir con https**.

## Archivos
- `popup.html/css/js`: la ventana de la extensión (cola, captura de las 60, licencia).
- `boton.js`: botón flotante en la página del Raven (content script).
- `llenar.js`: ubica las casillas, escribe y comprueba. Lo usan el popup y el botón.
- `capturas.js`: la cola de candidatos (elegir captura por cédula, marcar llenada, doble captura, migrar desde 0.5).
- `cedula.js`: lee la cédula de la URL, calcula su huella y la confirmación por segundo clic.
- `licencia.js`: verifica la clave de licencia. `background.js`: la verifica para el botón, atiende el atajo de teclado y abre la bienvenida al instalar.
- `bienvenida.html/css/js`: los tres pasos tras instalar (fijar ícono, activar licencia, usar).
- `analizar.js`: lee una lista pegada (columna de Excel, comas o espacios).
- `herramientas/licencia.js`: emite las claves. `herramientas/empaquetar.ps1`: arma el .zip.
- `tienda/`: ficha, permisos, aviso de privacidad e imágenes para la Chrome Web Store.
- `marca/logo.svg`: logo original (matriz 2×2 con la pieza que falta en rojo). `node marca/generar-iconos.js` regenera `iconos/icono-{16,32,48,128}.png`.

## Entregar a un cliente
Lo recomendado es la **Chrome Web Store como «No listada»**: el cliente instala con un clic, sin modo de desarrollador, y las actualizaciones llegan solas. Todo lo que pide la tienda está en [`tienda/ficha.md`](tienda/ficha.md).

El .zip sirve para la tienda y para instalar a mano: `powershell -ExecutionPolicy Bypass -File herramientas\empaquetar.ps1` arma `dist\raven-llenar-respuestas-v<versión>.zip` con solo lo que usa Chrome, la guía `INSTALAR.txt` y la `LICENSE`. No lo arma si `licencia.js` no tiene llave pública. Para probar esa copia tal cual: descomprímela y corre `EXTENSION_DIR=<carpeta> node pruebas/extension.js`.

## Pruebas
Usan Chromium con la extensión cargada de verdad y una página falsa en la URL de PsicoWeb (sin datos reales). La de punta a punta carga una copia con una llave de licencia de prueba. Necesitan Node y Playwright (`PLAYWRIGHT_DIR` si no está a la mano) y Chromium (`npx playwright install chromium`, o `CHROMIUM` con la ruta).

```
node pruebas/unitarias.js   # listas, cédula, cola, licencia, archivos del .zip y llenado
node pruebas/extension.js   # licencia, popup, cola, doble captura, atajo, botón, ↻, http, migración
```

GitHub Actions las corre en cada push (`.github/workflows/pruebas.yml`).

`pruebas/muestras/` guarda páginas reales de la captura (sin datos del candidato): las unitarias llenan cada una y comprueban que cada número cae en su lugar. Así un cambio de PsicoWeb aparece en las pruebas y no con un cliente. Cómo agregar una: `pruebas/muestras/LEEME.txt`.

## Licencia
Software propietario de Gerardo Barrera, todos los derechos reservados. Se usa solo con una licencia o suscripción por escrito; ver [LICENSE](LICENSE). No está afiliado a PsicoWeb.
