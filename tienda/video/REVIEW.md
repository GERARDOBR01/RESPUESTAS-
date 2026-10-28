# Revisión del video (v0.7.0)

**Decisiones**
- La interfaz es la real: la extensión con una licencia de prueba, grabada cuadro por cuadro (`grabar.js`). La página de captura es de ejemplo y lo dice («Página de ejemplo, sin datos reales»), porque no imitamos la marca de PsicoWeb.
- Los primeros 20 s van a lo que más importa: teclear a mano, contra un clic que escribe las 60.
- El llenado es instantáneo de verdad: no lo pusimos en cámara lenta ni en cascada.

**Qué se revisó**
- `hyperframes check` pasa en los dos formatos, sin errores.
- Cuadros clave de los mp4 ya decodificados: 0, 13.3, 29, 44 y 58 s.
- El contacto se lee en 9:16.

**Sonido (medido, no escuchado)**
- La mezcla final queda en −15.1 LUFS con pico de −1.2 dBTP.
- Los golpes caen con la imagen: el clic de «Llenar» a 12.905 s y las teclas Alt+Shift+L a 16.65, 16.70 y 16.76 s.
- De 0 a 9 s (a mano) va más bajo a propósito: −24 LUFS, contra −14.7 con música.
- Nadie lo ha oído: falta escucharlo para confirmar el gusto de la música y el volumen de los efectos.
- La música es CC BY 3.0 y **hay que dar el crédito** al publicar (`audio/CREDITOS.md`).

**La toma más débil**
- En 9:16 el popup se ve chico (583 px de ancho). Con más tiempo, haría tomas propias del popup a pantalla completa.

**Avisos que se quedaron a propósito**
- `nested_structure_needs_subcomposition` en el flood, el Excel y el logo: es un solo archivo generado, no se edita en Studio.
