// Arma los dos proyectos de HyperFrames del video desde un solo guion (SPEC.md):
// horizontal/index.html (1920×1080) y vertical/index.html (1080×1920). Copia a cada uno
// los clips de la interfaz real que grabó grabar.js en clips/.
// Uso: node tienda/video/armar.js   (después: npx hyperframes render en cada carpeta)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLIPS = path.join(__dirname, 'clips');
const AUDIO = path.join(__dirname, 'audio'); // música y efectos (ver audio/CREDITOS.md)

// Pico de cada efecto desde el inicio del archivo (npx hyperframes audio --only moments):
// el archivo arranca antes para que el golpe caiga un cuadro después de la imagen.
const PICO = { click: 0.073, 'key-press': 0.05, pop: 0.12, whoosh: 0.162, 'impact-bass-1': 0.073, chime: 0.05, sparkle: 0.1, error: 0.05 };
const DURA = { click: 0.37, 'key-press': 0.43, pop: 0.72, whoosh: 0.57, 'impact-bass-1': 2.12, chime: 2.54, sparkle: 1.8, error: 1.62, 'tecleo-6s': 5.64, 'tecleo-4s': 4.0 };
const CUADRO = 1 / 30;

// Música: entra en el compás fuerte justo antes del corte (8.97 s) para que el clic de
// «Llenar» (12.97 s) caiga en un tiempo fuerte (120 bpm). La escena «a mano» va sin música.
const MUSICA = { inicio: 8.97, volumen: 0.75 };

// Efectos: [archivo, momento en la imagen (s), volumen]. Cada uno tiene su causa en pantalla.
// Se reparten en cuatro carriles (9–12) porque algunos se enciman a propósito.
function efectos(tecleo) {
  const lista = [];
  // 1 · A mano: clic en la casilla y tecla, nueve veces.
  for (const t of tecleo) lista.push(['click', t - 0.3, 1.6], ['key-press', t, 1.8]);
  lista.push(
    ['whoosh', 9.3, 0.55],            // 2 · sube la tinta
    ['whoosh', 11.05, 0.35],          //     y se va
    ['click', 12.9, 1.6],             // 3 · clic en «Llenar»
    ['impact-bass-1', 12.97, 0.35],   //     las 60 escritas
    ['key-press', 16.6, 1.6], ['key-press', 16.65, 1.6], ['key-press', 16.7, 1.6], // Alt+Shift+L
    ['pop', 20.2, 0.6],               // 4 · se abre el popup
    ['tecleo-6s', 20.7, 1.2],         //     las 60 tecleadas
    ['whoosh', 28.5, 0.35],           //     la columna de Excel vuela
    ['pop', 28.93, 0.7],              //     y se pega
    ['click', 32.5, 1.6], ['pop', 32.57, 0.5],   // 5 · Beto
    ['click', 36.4, 1.6], ['pop', 36.47, 0.5],   //     Ana
    ['pop', 38.7, 0.6],               // 6 · popup otra vez
    ['click', 39.8, 1.6],             //     Verificar
    ['tecleo-4s', 40.3, 1.1],         //     segunda captura
    ['error', 40.83, 2.0],            //     la 17 no coincide
    ['click', 45.4, 1.6],             //     Terminar verificación
    ['key-press', 47.1, 1.6], ['chime', 47.13, 0.7], // corregida
    ['whoosh', 48.55, 0.45],          // 7 · se va la ventana
    ['sparkle', 53.35, 0.35],          // 8 · llega el logo
  );
  return lista;
}
const RAIZ = path.resolve(__dirname, '..', '..');
const DURACION = 60;

// Contacto del cierre: el mismo que muestra la extensión (licencia.js).
const CONTACTO = { nombre: 'Gerardo Barrera', whatsapp: '33 2263 4262', correo: 'jesusgerardobarrerasolis@gmail.com' };

// Medidas de cada formato. La página se grabó a 1280×800 CSS (2×) y el popup a 540 CSS de ancho (2×).
const FORMATOS = {
  horizontal: {
    carpeta: 'horizontal', w: 1920, h: 1080,
    ventana: { x: 720, y: 104, w: 1100 },
    popup: { escala: 1, derecha: 20 },
    texto: { x: 110, y: 250, w: 570 },
    // Lo que la cámara acerca no pasa de aquí, para no tapar el texto.
    mascara: 'linear-gradient(90deg, transparent 640px, #000 700px)',
    titulo: 68, cuerpo: 38, chico: 30,
  },
  vertical: {
    carpeta: 'vertical', w: 1080, h: 1920,
    ventana: { x: 40, y: 660, w: 1000 },
    popup: { escala: 1.08, centrado: true, y: 560 },
    texto: { x: 80, y: 200, w: 920 },
    mascara: 'linear-gradient(180deg, transparent 480px, #000 540px)',
    titulo: 88, cuerpo: 46, chico: 34,
  },
};
const BARRA = 56;

// Posiciones en los clips (CSS px de lo grabado), medidas en los cuadros de grabar.js.
const BOTON = { x: 1120, y: 761 };     // botón flotante «Llenar» en la página
const CASILLA17 = { x: 185, y: 373 };  // casilla 17 del popup en modo verificación
const CASILLA1 = { x: 81, y: 189 };    // casilla 1 del popup
const ALTO_POPUP = { captura: 694, verificar: 752 };

function geometria(f) {
  const v = f.ventana;
  const escalaPagina = v.w / 1280;
  const alto = Math.round(800 * escalaPagina);
  const pw = 540 * f.popup.escala;
  const popup = f.popup.centrado
    ? { x: Math.round((f.w - pw) / 2), y: f.popup.y }
    : { x: v.x + v.w - f.popup.derecha - pw, y: v.y + BARRA - 6 };
  return {
    ...v, alto, escalaPagina,
    pagina: (p) => ({ x: v.x + p.x * escalaPagina, y: v.y + BARRA + p.y * escalaPagina }),
    popup: { ...popup, w: pw, escala: f.popup.escala },
    enPopup: (p) => ({ x: popup.x + p.x * f.popup.escala, y: popup.y + p.y * f.popup.escala }),
  };
}

// Una línea de texto: palabras en <span class="p">; *palabra* va en el color de acento.
function linea(id, inicio, fin, texto, clase, estilo = '', extra = '') {
  const palabras = texto.split(' ').map((w) => {
    const acento = /^\*.*\*[,.]?$/.test(w);
    return `<span class="p${acento ? ' acento' : ''}">${w.replace(/\*/g, '')}</span>`;
  }).join(' ');
  return `<div id="${id}" class="clip linea ${clase}" data-start="${inicio}" data-duration="${(fin - inicio).toFixed(2)}" style="${estilo}"${extra}>${palabras}</div>`;
}

// Alto aproximado de un texto envuelto en «ancho» px (Inter: ~0.5 em por carácter en 700 y
// ~0.56 em en 400), para apilar líneas sin que se encimen.
function altoTexto(texto, size, ancho, negrita, interlinea) {
  const porLinea = Math.floor(ancho / (size * (negrita ? 0.5 : 0.56)));
  let lineas = 1;
  let largo = 0;
  for (const w of texto.replace(/\*/g, '').split(' ')) {
    if (largo && largo + 1 + w.length > porLinea) { lineas++; largo = w.length; } else largo += (largo ? 1 : 0) + w.length;
  }
  return lineas * size * interlinea;
}

function composicion(nombre, f) {
  const g = geometria(f);
  const V = nombre === 'vertical';
  const t = f.texto;
  const T = f.titulo;
  const C = f.cuerpo;
  const ANCHO_CENTRO = V ? 920 : 1500;
  const at = (y) => `left:${t.x}px;top:${Math.round(y)}px;width:${t.w}px`;
  const centrado = (y) => `left:${(f.w - ANCHO_CENTRO) / 2}px;top:${Math.round(y)}px;width:${ANCHO_CENTRO}px;text-align:center`;
  // Lo que ocupa una línea de cada clase, y dónde empieza la siguiente (con un espacio de «aire»).
  const medida = { titulo: [T, true, 1.12], grande: [Math.round(T * 1.25), true, 1.12], cuerpo: [C, false, 1.3], chico: [f.chico, false, 1.12] };
  const debajo = (y, texto, clase, ancho = t.w, aire = 0.45) => {
    const [size, negrita, lh] = medida[clase];
    return y + altoTexto(texto, size, ancho, negrita, lh) + size * aire;
  };

  const pantallaVideo = (id, src, inicio, dur) =>
    `<video id="${id}" class="clip" src="assets/clips/${src}.mp4" muted playsinline data-start="${inicio}" data-duration="${dur}" data-track-index="2"></video>`;
  const popupVideo = (id, src, inicio, dur) =>
    `<video id="${id}" class="clip" src="assets/clips/${src}.mp4" muted playsinline data-start="${inicio}" data-duration="${dur}" data-track-index="3"></video>`;

  const L = [];
  // 1 · A mano
  const s1 = {
    kicker: 'Hoy, con cada candidato:', titulo: '60 respuestas, casilla por casilla', ritmo: 'Clic, número. Clic, número…',
  };
  let y = t.y;
  if (!V) {
    L.push(linea('s1-kicker', 0, 9.3, s1.kicker, 'chico', at(y), ' data-sin-entrada'));
    y = debajo(y, s1.kicker, 'chico');
  }
  L.push(linea('s1-titulo', 0, 9.3, s1.titulo, 'titulo', at(y), ' data-sin-entrada'));
  y = debajo(y, s1.titulo, 'titulo');
  L.push(linea('s1-ritmo', 3.6, 9.3, s1.ritmo, 'cuerpo', at(y)));
  const relojY = debajo(y, s1.ritmo, 'cuerpo', t.w, 0.8);
  // 2 · Corte
  L.push(linea('s2-titulo', 9.55, 11.4, 'Ahora, *sin* hacerlo a mano', 'titulo grande blanco', centrado(V ? 860 : 470)));
  // 3 · Llenar
  L.push(linea('s3-clic', 11.6, 12.95, 'Un clic en «Llenar»…', 'titulo', at(t.y)));
  L.push(linea('s3-listo', 13.3, V ? 17.5 : 20.0, 'y las *60* quedan escritas', 'titulo', at(t.y)));
  y = debajo(t.y, 'y las 60 quedan escritas', 'titulo', t.w, 0.8);
  L.push(linea('s3-teclado', 15.6, 20.0, 'O con el teclado:', 'cuerpo', at(y)));
  const teclasY = debajo(y, 'O con el teclado:', 'cuerpo', t.w, 0.35);
  // En vertical no cabe debajo: reemplaza al título.
  if (V) L.push(linea('s3-revisas', 17.6, 20.0, 'Tú revisas y guardas, como siempre', 'titulo', at(t.y)));
  else L.push(linea('s3-revisas', 17.6, 20.0, 'Tú revisas y guardas, como siempre', 'cuerpo tenue', at(teclasY + C * 2.6)));
  // 4 · Captura
  L.push(linea('s4-una', 20.4, 24.1, 'Las capturas *una* vez en la extensión', 'titulo', at(t.y)));
  L.push(linea('s4-salta', 24.3, 27.9, 'Escribes el número y salta sola a la siguiente', 'titulo', at(t.y)));
  L.push(linea('s4-excel', 28.0, 30.9, '¿Ya las tienes en Excel? *Pega* la columna', 'titulo', at(t.y)));
  // 5 · Grupo
  L.push(linea('s5-grupo', 31.0, 38.7, '¿Aplicas en *grupo?*', 'titulo', at(t.y)));
  y = debajo(t.y, '¿Aplicas en grupo?', 'titulo');
  const s5 = 'Cada página usa las respuestas de su candidato, por su cédula';
  L.push(linea('s5-cedula', 32.2, 38.7, s5, 'cuerpo', at(y)));
  y = debajo(y, s5, 'cuerpo');
  L.push(linea('s5-faltan', 35.2, 38.7, 'Y te dice cuántos faltan', 'cuerpo tenue', at(y)));
  // 6 · Doble captura
  L.push(linea('s6-doble', 38.9, 48.7, 'Doble *captura*', 'titulo', at(t.y)));
  y = debajo(t.y, 'Doble captura', 'titulo');
  L.push(linea('s6-rojo', 39.6, 44.7, 'Tecleas la hoja otra vez: lo que no coincide sale en rojo', 'cuerpo', at(y)));
  L.push(linea('s6-corriges', 44.9, 48.7, 'Corriges con la hoja y queda verificada', 'cuerpo', at(y)));
  // 7 · Privacidad
  y = V ? 760 : 400;
  const s7 = 'Todo se queda en *tu* computadora';
  L.push(linea('s7-local', 48.9, 53.2, s7, 'titulo grande', centrado(y)));
  y = debajo(y, s7, 'grande', ANCHO_CENTRO);
  L.push(linea('s7-servidor', 50.5, 53.2, 'No envía datos a ningún servidor', 'cuerpo tenue', centrado(y)));
  // 8 · Cierre
  const nombreY = V ? 820 : 470;
  y = nombreY;
  const cierre = [
    ['s8-nombre', 54.0, 'Raven · llenar respuestas', 'titulo', 'titulo'],
    ['s8-frase', 54.6, 'Captura una vez · llena con un *clic*', 'cuerpo', 'cuerpo', 1.1],
    ...(V
      ? [['s8-contacto', 55.4, CONTACTO.nombre, 'cuerpo fuerte', 'cuerpo', 0.2], ['s8-whatsapp', 55.55, `WhatsApp ${CONTACTO.whatsapp}`, 'cuerpo fuerte', 'cuerpo', 0.2]]
      : [['s8-contacto', 55.4, `${CONTACTO.nombre} · WhatsApp ${CONTACTO.whatsapp}`, 'cuerpo fuerte', 'cuerpo', 0.2]]),
    ['s8-correo', 55.7, CONTACTO.correo, 'cuerpo fuerte', 'cuerpo', 1.0],
    ['s8-nota', 56.4, 'Para la captura del Raven en PsicoWeb · No afiliado a PsicoWeb', 'chico tenue', 'chico'],
  ];
  for (const [id, ini, texto, clase, medidaDe, aire] of cierre) {
    L.push(linea(id, ini, DURACION, texto, clase, centrado(y)));
    y = debajo(y, texto, medidaDe, ANCHO_CENTRO, aire ?? 0.45);
  }
  const lineas = L.join('\n      ');

  // Teclas del atajo, bajo «O con el teclado:».
  const teclas = `<div id="s3-teclas" class="clip teclas" data-start="15.8" data-duration="4.2" style="left:${t.x}px;top:${Math.round(teclasY)}px">
        <span class="tecla">Alt</span><span class="mas">+</span><span class="tecla">Shift</span><span class="mas">+</span><span class="tecla">L</span>
      </div>`;

  // Reloj y conteo de la escena a mano.
  const reloj = `<div id="s1-reloj" class="clip reloj" data-start="0" data-duration="9.3" style="left:${t.x}px;top:${Math.round(relojY)}px">
        <span class="punto-rojo"></span><span id="s1-tiempo">0:00</span><span class="sep">·</span><span id="s1-cuenta">0 de 60</span>
      </div>`;

  // Columna de Excel que se pega en la casilla 1.
  const filas = '3124657321'.split('').map((d, i) => `<div class="celda-x"><b>${i + 1}</b><span>${d}</span></div>`).join('');
  const excelX = V ? 80 : g.popup.x - 260;
  const excelY = V ? g.popup.y + 120 : g.popup.y + 140;
  const excel = `<div id="s4-excel-hoja" class="clip excel" data-layout-ignore data-start="28.0" data-duration="1.2" style="left:${excelX}px;top:${excelY}px">
        <div class="excel-int"><div class="excel-cab">A</div>${filas}<div class="celda-x"><b>…</b><span>…</span></div></div>
      </div>`;

  // El logo va dos veces (ícono y cierre): cada copia con sus propios ids de degradado.
  const svgLogo = fs.readFileSync(path.join(RAIZ, 'marca', 'logo.svg'), 'utf8').replace(/<!--.*?-->/gs, '');
  const logoCon = (pre) => svgLogo.replace(/id="([^"]+)"/g, `id="${pre}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pre}-$1)`);
  const logo = logoCon('logo-cierre');
  const tamLogo = V ? 220 : 170;
  const cierreLogo = `<div id="s8-logo" class="clip logo" data-start="53.3" data-duration="${(DURACION - 53.3).toFixed(1)}" style="left:${(f.w - tamLogo) / 2}px;top:${nombreY - tamLogo - (V ? 70 : 44)}px;width:${tamLogo}px;height:${tamLogo}px">
        <div class="logo-int">${logo.replace('<svg ', `<svg style="width:100%;height:100%" `)}</div>
      </div>`;

  const P = g.popup;
  const boton = g.pagina(BOTON);
  const c17 = g.enPopup(CASILLA17);
  const c1 = g.enPopup(CASILLA1);

  const datos = {
    V, w: f.w, h: f.h, popup: P,
    boton, c17, c1,
    // Momentos medidos en los clips (grabar.js): tecleo de cada casilla en «a mano»,
    // clic en Llenar, la casilla 17 en rojo y su corrección.
    tecleo: Array.from({ length: 9 }, (_, k) => +(1.2 + k * 29 / 30).toFixed(3)),
  };

  return `<!doctype html>
<html lang="es" data-composition-variables='[
  {"id":"color-fondo","type":"color","label":"Fondo","default":"#eef1f6"},
  {"id":"color-tinta","type":"color","label":"Texto","default":"#1d2433"},
  {"id":"color-acento","type":"color","label":"Acento","default":"#e5484d"}
]'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${f.w}, height=${f.h}" />
    <!-- Generado por tienda/video/armar.js: los cambios van ahí. -->
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      :root { --color-fondo: #eef1f6; --color-tinta: #1d2433; --color-acento: #e5484d; --tenue: #5b6475; --azul: #1e88e5; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${f.w}px; height: ${f.h}px; overflow: hidden; background: var(--color-fondo); }
      #root { position: relative; width: 100%; height: 100%; font-family: Inter, sans-serif; color: var(--color-tinta); }
      #fondo { position: absolute; inset: 0;
        background:
          radial-gradient(circle at 12% 8%, rgba(229, 72, 77, 0.22), transparent 45%),
          radial-gradient(circle at 92% 90%, rgba(30, 136, 229, 0.25), transparent 50%),
          var(--color-fondo); }
      #encuadre { position: absolute; inset: 0; -webkit-mask-image: ${f.mascara}; mask-image: ${f.mascara}; }
      #camara { position: absolute; inset: 0; }
      .ventana { position: absolute; left: ${g.x}px; top: ${g.y}px; width: ${g.w}px; height: ${BARRA + g.alto}px;
        border-radius: 16px; overflow: hidden; background: #fff; box-shadow: 0 30px 80px rgba(29, 36, 51, 0.22), 0 0 0 1px rgba(29, 36, 51, 0.06); }
      .barra { height: ${BARRA}px; display: flex; align-items: center; gap: 14px; padding: 0 16px; background: #f1f3f7; border-bottom: 1px solid #e3e7ef; }
      .puntos { display: flex; gap: 7px; } .puntos i { width: 12px; height: 12px; border-radius: 50%; background: #d5dae3; display: block; }
      .url { flex: 1; height: 34px; border-radius: 17px; background: #fff; display: flex; align-items: center; padding: 0 16px;
        font: 400 17px Inter, sans-serif; color: var(--tenue); white-space: nowrap; overflow: hidden; }
      .url b { color: var(--color-tinta); font-weight: 400; }
      .icono { width: 32px; height: 32px; border-radius: 8px; overflow: hidden; }
      .icono svg { width: 100%; height: 100%; display: block; }
      .pantalla { position: relative; width: ${g.w}px; height: ${g.alto}px; background: #f4f6fa; }
      .pantalla img, .pantalla video { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }
      .popup { position: absolute; left: ${P.x}px; top: ${P.y}px; width: ${P.w}px; overflow: hidden; border-radius: 12px;
        box-shadow: 0 24px 60px rgba(29, 36, 51, 0.28), 0 0 0 1px rgba(29, 36, 51, 0.08); opacity: 0; }
      #popup-a { height: ${ALTO_POPUP.captura * P.escala}px; }
      #popup-b { height: ${ALTO_POPUP.verificar * P.escala}px; }
      .popup video { position: absolute; left: 0; top: 0; width: ${P.w}px; height: auto; }
      .linea { position: absolute; line-height: 1.12; }
      .linea .p { display: inline-block; }
      .titulo { font-size: ${T}px; font-weight: 700; letter-spacing: -0.02em; }
      .grande { font-size: ${Math.round(T * 1.25)}px; }
      .cuerpo { font-size: ${C}px; font-weight: 400; line-height: 1.3; }
      .chico { font-size: ${f.chico}px; font-weight: 400; color: var(--tenue); }
      .tenue { color: var(--tenue); }
      .fuerte { font-weight: 700; }
      .blanco { color: #fff; z-index: 6; }
      .acento { color: #cf3439; }
      #s2-flood { position: absolute; inset: 0; z-index: 5; }
      #s2-tinta { position: absolute; inset: 0; background: var(--color-tinta); }
      .reloj { position: absolute; display: flex; align-items: center; gap: 12px; padding: 12px 22px; border-radius: 999px;
        background: #fff; box-shadow: 0 8px 24px rgba(29, 36, 51, 0.12); font: 700 ${C}px Inter, sans-serif; font-variant-numeric: tabular-nums; }
      .reloj .sep { color: var(--tenue); font-weight: 400; }
      .punto-rojo { width: 14px; height: 14px; border-radius: 50%; background: var(--color-acento); display: block; }
      .teclas { position: absolute; display: flex; align-items: center; gap: 14px; }
      .tecla { display: inline-block; min-width: ${Math.round(C * 2)}px; padding: ${Math.round(C * 0.35)}px ${Math.round(C * 0.5)}px; border-radius: 12px; background: #fff;
        border: 1px solid #d5dae3; box-shadow: 0 5px 0 #c9d0dd; font: 700 ${C}px Inter, sans-serif; text-align: center; }
      .mas { font: 400 ${C}px Inter, sans-serif; color: var(--tenue); }
      .excel { position: absolute; width: 200px; z-index: 4; }
      .excel-int { background: #fff; border: 1px solid #c9d0dd; border-radius: 10px; overflow: hidden; box-shadow: 0 18px 40px rgba(29, 36, 51, 0.2); }
      .excel-cab { background: #e9f4ec; color: #1a7f37; font: 700 20px Inter, sans-serif; text-align: center; padding: 6px 0; border-bottom: 1px solid #c9d0dd; }
      .celda-x { display: flex; font: 400 22px Inter, sans-serif; border-bottom: 1px solid #edf0f5; }
      .celda-x b { width: 48px; text-align: center; color: var(--tenue); font-weight: 400; background: #f6f7fa; padding: 3px 0; }
      .celda-x span { flex: 1; text-align: center; padding: 3px 0; }
      .logo { position: absolute; }
      .logo-int { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${DURACION}" data-width="${f.w}" data-height="${f.h}">
      <div id="fondo"></div>
      <div id="encuadre"><div id="camara">
        <div id="ventana" class="ventana">
          <div class="barra" data-layout-ignore>
            <div class="puntos"><i></i><i></i><i></i></div>
            <div class="url"><b>app.psicoweb.com</b>/Raven/IntroducirRespuestas</div>
            <div class="icono">${logoCon('logo-icono')}</div>
          </div>
          <div class="pantalla">
            <img id="pagina-base" src="assets/clips/pagina.png" alt="" />
            ${pantallaVideo('v-amano', 'amano', 0, 9.3)}
            ${pantallaVideo('v-llenar', 'llenar', 11.4, 8.6)}
            ${pantallaVideo('v-beto', 'cola-beto', 30.9, 3.9)}
            ${pantallaVideo('v-ana', 'cola-ana', 34.8, 3.9)}
          </div>
        </div>
        <div id="popup-a" class="popup" data-layout-allow-overflow>
          ${popupVideo('v-captura', 'captura', 20.2, 7.7)}
          ${popupVideo('v-pegar', 'pegar', 27.9, 3.0)}
        </div>
        <div id="popup-b" class="popup" data-layout-allow-overflow>
          ${popupVideo('v-verificar', 'verificar', 38.7, 10.0)}
        </div>
      </div></div>
      ${excel}
      ${reloj}
      ${teclas}
      <div id="s2-flood" class="clip" data-start="9.3" data-duration="2.1"><div id="s2-tinta"></div></div>
      ${lineas}
      ${cierreLogo}
      <audio id="musica" class="clip" src="assets/audio/musica.mp3" data-start="${MUSICA.inicio}" data-duration="${(DURACION - MUSICA.inicio).toFixed(2)}" data-volume="${MUSICA.volumen}" data-track-index="8"></audio>
      ${efectos(datos.tecleo).map(([archivo, t, vol], i) => {
        const inicio = Math.max(0, t + CUADRO - (PICO[archivo] || 0));
        const dur = Math.min(DURA[archivo], DURACION - inicio);
        return `<audio id="sfx-${i}" class="clip" src="assets/audio/${archivo}.mp3" data-start="${inicio.toFixed(3)}" data-duration="${dur.toFixed(2)}" data-volume="${vol}" data-track-index="${9 + (i % 4)}"></audio>`;
      }).join('\n      ')}
    </div>
    <script>
      const D = ${JSON.stringify(datos)};
      const tl = gsap.timeline({ paused: true });

      // Líneas: llegan palabra por palabra (blur 6 → 0) y se van con blur antes de su fin.
      document.querySelectorAll('.linea').forEach((el) => {
        const ini = +el.dataset.start;
        const fin = ini + +el.dataset.duration;
        const p = el.querySelectorAll('.p');
        if (!el.hasAttribute('data-sin-entrada')) {
          tl.fromTo(p, { opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.13, stagger: 0.067, ease: 'power2.out' }, ini);
        }
        if (fin < ${DURACION} - 0.01) tl.to(p, { opacity: 0, filter: 'blur(6px)', duration: 0.18, stagger: 0.02, ease: 'power3.in' }, fin - 0.24);
      });

      // Cámara: acercar el punto P a escala s dejándolo en su lugar (origen 0 0).
      gsap.set('#camara', { transformOrigin: '0 0' });
      const enfoque = (p, s) => ({ x: p.x * (1 - s), y: p.y * (1 - s), scale: s });
      const camara = (p, s, t, dur, ease = 'power2.inOut') => tl.to('#camara', { ...enfoque(p, s), duration: dur, ease }, t);
      const vuelta = (t, dur = 0.8) => tl.to('#camara', { x: 0, y: 0, scale: 1, duration: dur, ease: 'power2.inOut' }, t);
      // Con el popup abierto (16:9) la cámara se queda un poco más cerca para leerlo.
      const cercaPopup = D.V ? null : { x: D.popup.x + D.popup.w / 2, y: 509 };
      const alPopup = (t, dur = 0.8) => (cercaPopup ? camara(cercaPopup, 1.18, t, dur) : vuelta(t, dur));
      // Dónde queda en pantalla un punto del popup con la cámara en cercaPopup.
      const enPantalla = (p) => (cercaPopup ? { x: cercaPopup.x + (p.x - cercaPopup.x) * 1.18, y: cercaPopup.y + (p.y - cercaPopup.y) * 1.18 } : p);

      // 1 · A mano: reloj y conteo al ritmo del clip.
      const tiempo = document.getElementById('s1-tiempo');
      const cuenta = document.getElementById('s1-cuenta');
      tl.to({ s: 0 }, { s: 9.3, duration: 9.3, ease: 'none', onUpdate() {
        const s = this.targets()[0].s;
        tiempo.textContent = '0:' + String(Math.floor(s)).padStart(2, '0');
        cuenta.textContent = D.tecleo.filter((x) => x <= s).length + ' de 60';
      } }, 0);

      // 2 · Corte: la tinta sube y cubre todo; luego se va hacia arriba.
      tl.fromTo('#s2-tinta', { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.4, ease: 'power2.inOut' }, 9.3);
      tl.to('#s2-tinta', { clipPath: 'inset(0 0 100% 0)', duration: 0.35, ease: 'power3.in' }, 11.05);

      // 3 · Llenar: la cámara va al botón, clic (12.97), se aleja y se ven las 60.
      camara(D.boton, D.V ? 2.0 : 1.8, 11.9, 0.7);
      vuelta(13.15, 0.8);
      tl.fromTo('#s3-teclas .tecla', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12, ease: 'expo.out' }, 15.8);
      tl.to('#s3-teclas .tecla', { y: 5, boxShadow: '0 0 0 #c9d0dd', duration: 0.08, stagger: 0.05, ease: 'power2.out' }, 16.6);
      tl.to('#s3-teclas .tecla', { y: 0, boxShadow: '0 5px 0 #c9d0dd', duration: 0.12, ease: 'power2.out' }, 16.9);
      tl.to('#s3-teclas', { opacity: 0, duration: 0.2, ease: 'power3.in' }, 19.95);

      // 4 · El popup sale del ícono de la extensión.
      gsap.set('.popup', { transformOrigin: D.V ? '50% 0%' : '92% 0%' });
      tl.to('#ventana', { opacity: D.V ? 0.35 : 0.55, duration: 0.4, ease: 'power2.inOut' }, 20.1);
      tl.fromTo('#popup-a', { opacity: 0, scale: 0.9, y: -16 }, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'expo.out' }, 20.2);
      alPopup(20.9, 0.8);
      // La columna de Excel entra y se mete en la casilla 1 justo cuando se pega (28.9).
      tl.fromTo('#s4-excel-hoja .excel-int', { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.45, ease: 'expo.out' }, 28.0);
      tl.to('#s4-excel-hoja .excel-int', {
        x: enPantalla(D.c1).x - ${excelX} - 100, y: enPantalla(D.c1).y - ${excelY} - 20, scale: 0.25, opacity: 0, duration: 0.42, ease: 'power3.in',
      }, 28.5);
      tl.to('#popup-a', { opacity: 0, scale: 0.96, duration: 0.22, ease: 'power3.in' }, 30.68);
      vuelta(30.6, 0.3);
      tl.to('#ventana', { opacity: 1, duration: 0.35, ease: 'power2.inOut' }, 30.7);

      // 5 · Grupo: acercar al aviso «faltan 1» tras el clic en la página de Beto (32.6).
      camara(D.boton, D.V ? 1.9 : 1.6, 32.7, 0.6);
      vuelta(34.0, 0.7);

      // 6 · Doble captura: la 17 sale en rojo (41.4) y se corrige (47.1).
      tl.to('#ventana', { opacity: D.V ? 0.35 : 0.55, duration: 0.35, ease: 'power2.inOut' }, 38.6);
      tl.fromTo('#popup-b', { opacity: 0, scale: 0.9, y: -16 }, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'expo.out' }, 38.7);
      alPopup(39.3, 0.7);
      camara(D.c17, 1.9, 41.2, 0.6);
      alPopup(42.7, 0.7);
      camara(D.c17, 1.9, 46.6, 0.6);
      vuelta(48.0, 0.5);

      // 7 · Privacidad: la ventana y el popup se van; queda el texto.
      tl.to(['#popup-b', '#ventana'], { opacity: 0, scale: 0.96, duration: 0.3, ease: 'power3.in' }, 48.55);

      // 8 · Cierre: llega el logo.
      tl.fromTo('#s8-logo .logo-int', { opacity: 0, scale: 0.6, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.3)' }, 53.3);

      window.__timelines = window.__timelines || {};
      window.__timelines['main'] = tl;
    </script>
  </body>
</html>
`;
}

// Fondo de la ventana mientras no hay clip: la página vacía con el botón (primer cuadro de «llenar»).
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(CLIPS, 'llenar.mp4'), '-frames:v', '1', path.join(CLIPS, 'pagina.png')]);
for (const [nombre, f] of Object.entries(FORMATOS)) {
  const proyecto = path.join(__dirname, f.carpeta);
  fs.rmSync(path.join(proyecto, 'assets', 'clips'), { recursive: true, force: true });
  fs.cpSync(CLIPS, path.join(proyecto, 'assets', 'clips'), { recursive: true });
  fs.rmSync(path.join(proyecto, 'assets', 'audio'), { recursive: true, force: true });
  fs.cpSync(AUDIO, path.join(proyecto, 'assets', 'audio'), { recursive: true });
  fs.writeFileSync(path.join(proyecto, 'index.html'), composicion(nombre, f));
  console.log(`tienda/video/${f.carpeta}/index.html · ${f.w}×${f.h}`);
}
