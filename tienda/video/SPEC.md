# Raven · llenar respuestas — video demo

GOAL:    Quien captura el Raven en PsicoWeb ve que deja de teclear las 60 casillas a mano: un clic las escribe todas. Al final sabe a quién escribirle.
OUTPUT:  HyperFrames. index.html es 1920×1080 y vertical.html es 1080×1920, ambos a 30 fps. Los dos los genera `../armar.js`; no se editan a mano.
TIME:    60 s × 30 = 1800 cuadros. Sin música ni voz (el usuario no la pidió, y ai-music necesita RUNCOMFY_TOKEN).
LOOK:    - Fondo: el del popup de la extensión, #eef1f6 con dos manchas radiales de la marca: rojo #e5484d al 22 % arriba a la izquierda y azul #1e88e5 al 25 % abajo a la derecha.
         - Tinta #1d2433, texto secundario #5b6475. Acento rojo #e5484d (la pieza que falta del logo), solo en la palabra clave de cada escena y en el cierre. Azul #1e88e5 solo dentro de la UI.
         - Tipografía Inter: títulos en 700, 72 px (16:9) o 92 px (9:16), tracking −2 %; texto en 400, 38 px o 48 px.
         - Material: la interfaz real grabada a 2× (proyecto/assets/clips) dentro de una ventana de navegador blanca de radio 16 px, con sombra 0 30 80 rgba(29,36,51,.22).
OBJECTS: - La ventana de Chrome: pestaña, barra de URL «app.psicoweb.com/Raven/IntroducirRespuestas» e ícono de la extensión.
         - El popup real de la extensión, que sale del ícono.
         - Una columna de Excel (tarjeta blanca con celdas).
         - Las teclas Alt, Shift y L como teclas físicas.
         - El logo (marca/logo.svg).
MOTION:  - Entradas con expo.out, 0.5–0.7 s. Cámara con power2.inOut, 0.6–0.9 s. Salidas con power3.in, 0.25 s.
         - Títulos palabra por palabra con blur de 6 px a 0, 0.13 s, separadas 0.07 s. Una vez que llegan, no se mueven.
SHOTS:   - 0–9.3 · A mano: la página vacía y el cursor que teclea casilla por casilla; un reloj y el conteo «n de 60» suben al ritmo del clip.
         - 9.3–11.4 · Flood de tinta con «Ahora, sin hacerlo a mano».
         - 11.4–20.2 · Llenar: la cámara se acerca al botón, clic, se aleja y aparecen las 60 llenas. Luego las teclas Alt+Shift+L y «Tú revisas y guardas».
         - 20.2–30.9 · El popup sale del ícono. Se teclean las 60 y después se pega una columna de Excel.
         - 30.9–38.7 · Grupo: la página de Beto (faltan 1) y luego la de Ana.
         - 38.7–48.7 · Doble captura: se acerca a la casilla 17 en rojo y se corrige.
         - 48.7–53.2 · Privacidad, solo texto grande.
         - 53.2–60 · Cierre: el logo llega, nombre, frase y contacto; se sostiene al menos 3 s.
BANNED:  - fondo oscuro con UI flotando chica; brillos o partículas; tarjetas de vidrio puestas a propósito (el vidrio es del popup real);
         - todo entrando con fade y subida; títulos que se mueven después de llegar; logo en una esquina;
         - anillos de clic; afirmar tiempos que no se midieron («en segundos»); la marca de PsicoWeb (solo la URL, como compatibilidad).
QA:      - t=0: título y página visibles (es la miniatura).
         - t=13.3: las 60 casillas llenas y legibles.
         - t=44: la casilla 17 en rojo.
         - t=58: el contacto, legible a 360 px de ancho.
