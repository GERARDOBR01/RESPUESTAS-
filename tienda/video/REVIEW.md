# Revisión del video (v0.7.0)

**Decisiones**
- La interfaz es la real: la extensión con una licencia de prueba, grabada cuadro por cuadro (`grabar.js`). La página de captura es de ejemplo y lo dice («Página de ejemplo, sin datos reales»), porque no imitamos la marca de PsicoWeb.
- Los primeros 20 s van a lo que más importa: teclear a mano, contra un clic que escribe las 60.
- El llenado es instantáneo de verdad: no lo pusimos en cámara lenta ni en cascada.

**Qué se revisó**
- `hyperframes check` pasa en los dos formatos, sin errores.
- Cuadros clave de los mp4 ya decodificados: 0, 13.3, 29, 44 y 58 s.
- El contacto se lee en 9:16.

**Nadie lo revisó**
- El video no tiene sonido. Fue a propósito (el aviso `film_silent` se dejó así).
- Para ponerle música: la skill ai-music con `RUNCOMFY_TOKEN`, o una pista propia como `<audio id="musica">` en `armar.js`.

**La toma más débil**
- En 9:16 el popup se ve chico (583 px de ancho). Con más tiempo, haría tomas propias del popup a pantalla completa.

**Avisos que se quedaron a propósito**
- `nested_structure_needs_subcomposition` en el flood, el Excel y el logo: es un solo archivo generado, no se edita en Studio.
