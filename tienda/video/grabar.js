// Graba los clips del video con la extensión de verdad: copia la extensión con una licencia
// de prueba, abre la página de ejemplo (pagina-demo.js) en la URL de la captura del Raven y
// maneja el popup y la página cuadro por cuadro (30 fps). Cada clip queda como
// clips/<nombre>.mp4; el video se arma con HyperFrames (armar.js → horizontal/ y vertical/).
// Uso: node tienda/video/grabar.js [clip…]
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ, cargarPlaywright, rutaChromium } = require('../../pruebas/entorno');
const { firmarClave, publicaJwk, escribirPublica } = require('../../herramientas/licencia.js');
const { paginaDemo } = require('./pagina-demo');

const FPS = 30;
const SALIDA = path.join(__dirname, 'clips');
const BASE = 'https://app.psicoweb.com/Raven/IntroducirRespuestas?cedula=';
const ANA = { nombre: 'Ana López', cedula: 'AAAA000000AAAAAA01', respuestas: '312465732184657321846573214865732148657321846573216548732165' };
const BETO = { nombre: 'Beto Ruiz', cedula: 'BBBB000000BBBBBB02', respuestas: '456732184657321846573221846573214865732148657321654873216541' };
// Todo se graba al doble de resolución (deviceScaleFactor 2) para poder acercar la cámara.
const PAGINA = { width: 1280, height: 800 };
const POPUP = { width: 540, height: 760 };

const CURSOR = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
  <path d="M3 2 L3 21 L8.2 16.4 L11.6 24 L15 22.5 L11.7 15 L18.5 15 Z" fill="#1d2433" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

// Un clip: cada cuadro es una captura de pantalla; si nada cambió se repite la anterior.
class Clip {
  constructor(pagina, nombre, temporal) {
    this.pagina = pagina;
    this.nombre = nombre;
    this.dir = fs.mkdtempSync(path.join(temporal, nombre + '-'));
    this.n = 0;
    this.ultimo = null;
    this.cursor = null;
  }

  // Avanza las animaciones de la página (Web Animations) al ritmo del video, no del reloj.
  async cuadro(veces = 1, { fotografiar = true } = {}) {
    for (let k = 0; k < veces; k++) {
      if (fotografiar || !this.ultimo) {
        await this.pagina.evaluate((ms) => {
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = (a.currentTime || 0) + ms;
          }
        }, 1000 / FPS);
        this.ultimo = path.join(this.dir, `${String(this.n).padStart(5, '0')}.png`);
        await this.pagina.screenshot({ path: this.ultimo });
      } else {
        fs.copyFileSync(this.ultimo, path.join(this.dir, `${String(this.n).padStart(5, '0')}.png`));
      }
      this.n++;
    }
  }

  async quieto(segundos) {
    const cuadros = Math.round(segundos * FPS);
    const animando = await this.pagina.evaluate(() => document.getAnimations().length > 0);
    if (animando) return this.cuadro(cuadros);
    await this.cuadro(1);
    return this.cuadro(cuadros - 1, { fotografiar: false });
  }

  async ponerCursor(x, y) {
    this.cursor = { x, y };
    await this.pagina.evaluate(({ x, y, svg }) => {
      let c = document.getElementById('video-cursor');
      if (!c) {
        c = document.createElement('div');
        c.id = 'video-cursor';
        c.innerHTML = svg;
        c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform-origin:3px 2px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))';
        document.documentElement.append(c);
      }
      c.style.transform = `translate(${x - 3}px, ${y - 2}px)`;
    }, { x, y, svg: CURSOR });
  }

  async presionar(abajo) {
    await this.pagina.evaluate((abajo) => {
      const c = document.getElementById('video-cursor');
      if (c) c.firstElementChild.style.transform = abajo ? 'scale(0.86)' : '';
    }, abajo);
  }

  // Mueve el cursor con aceleración suave (power2.inOut) durante «segundos».
  async mover(x, y, segundos) {
    const desde = this.cursor || { x, y };
    const cuadros = Math.max(1, Math.round(segundos * FPS));
    for (let k = 1; k <= cuadros; k++) {
      const t = k / cuadros;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      await this.ponerCursor(desde.x + (x - desde.x) * e, desde.y + (y - desde.y) * e);
      await this.cuadro();
    }
  }

  async centro(selector) {
    const caja = await this.pagina.locator(selector).first().boundingBox();
    return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
  }

  // Lleva el cursor al elemento, lo aprieta (2 cuadros) y da el clic de verdad.
  async clic(selector, segundos = 0.6) {
    const { x, y } = await this.centro(selector);
    await this.mover(x, y, segundos);
    await this.presionar(true);
    await this.cuadro(2);
    await this.pagina.locator(selector).first().click();
    await this.presionar(false);
    await this.cuadro();
  }

  terminar() {
    fs.mkdirSync(SALIDA, { recursive: true });
    const destino = path.join(SALIDA, `${this.nombre}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(this.dir, '%05d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', destino]);
    console.log(`${path.relative(process.cwd(), destino)} · ${(this.n / FPS).toFixed(2)} s`);
    fs.rmSync(this.dir, { recursive: true, force: true });
  }
}

(async () => {
  const pedidos = process.argv.slice(2);
  const { chromium } = cargarPlaywright();
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-video-'));
  const extension = path.join(temporal, 'extension');
  fs.cpSync(RAIZ, extension, { recursive: true, filter: (f) => !/[\\/](\.git|dist|node_modules|tienda)$/.test(f) });
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  escribirPublica(publicaJwk(privateKey), path.join(extension, 'licencia.js'));
  const vence = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const ctx = await chromium.launchPersistentContext(path.join(temporal, 'perfil'), {
    executablePath: rutaChromium(chromium),
    headless: true,
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  await ctx.route('https://app.psicoweb.com/**', (ruta) => {
    const cedula = new URL(ruta.request().url()).searchParams.get('cedula');
    const quien = [ANA, BETO].find((c) => c.cedula === cedula) || ANA;
    ruta.fulfill({ contentType: 'text/html; charset=utf-8', body: paginaDemo(quien) });
  });

  try {
    const ext = await ctx.newPage();
    await ext.goto('chrome://extensions');
    const info = await ext.evaluate(() => new Promise((r) => chrome.developerPrivate.getExtensionsInfo(r)));
    const ID = info.find((e) => e.name === 'Raven · llenar respuestas').id;
    await ext.goto(`chrome-extension://${ID}/popup.html`);
    await ext.evaluate((clave) => chrome.storage.local.set({ licencia: clave }), firmarClave(privateKey, 'Clínica Ejemplo', vence).clave);
    for (const p of ctx.pages()) if (p.url().endsWith('bienvenida.html')) await p.close();

    // Deja la cola con estas capturas ({ ...candidato, lleno, llenada }) y la primera abierta.
    const preparar = (lista) => ext.evaluate((lista) => {
      const capturas = [];
      for (const k of lista) {
        const c = nuevaCaptura(capturas);
        c.nombre = k.nombre;
        c.huella = huellaCedula(k.cedula);
        c.pista = pistaDe(k.cedula);
        c.respuestas = k.lleno ? k.respuestas.split('') : Array(60).fill('');
        c.llenada = k.llenada ? Date.now() : null;
        capturas.push(c);
      }
      return chrome.storage.local.set({ capturas, actual: capturas[0].id });
    }, lista);

    const abrirRaven = async (quien) => {
      const p = await ctx.newPage();
      await p.setViewportSize(PAGINA);
      await p.goto(BASE + quien.cedula);
      await p.locator('#raven-llenar').waitFor({ state: 'attached' });
      await p.waitForTimeout(300);
      return p;
    };
    const abrirPopup = async () => {
      const p = await ctx.newPage();
      await p.setViewportSize(POPUP);
      await p.addInitScript(() => {
        const original = chrome.tabs.query.bind(chrome.tabs);
        chrome.tabs.query = (q) => (q && q.active ? original({ url: 'https://app.psicoweb.com/*' }) : original(q));
      });
      await p.goto(`chrome-extension://${ID}/popup.html`);
      await p.waitForFunction(() => document.documentElement.dataset.listo === 'si');
      // Como en Chrome: la ventana del popup mide lo que mide el contenido.
      await p.addStyleTag({ content: 'html, body { overflow: hidden; } *:focus-visible { outline: none; }' });
      await p.waitForTimeout(200);
      return p;
    };
    const cerrarTodo = async () => {
      for (const p of ctx.pages()) if (p !== ext) await p.close();
    };
    // El botón de la página regresa a su texto normal a los 2.5 s de reloj; en el video el
    // mensaje debe durar lo que dura en pantalla, así que se sostiene mientras se graba.
    const sostenerMensaje = (p) => p.evaluate(() => {
      const raiz = document.getElementById('raven-llenar').shadowRoot;
      const boton = raiz.querySelector('button');
      const texto = raiz.querySelector('.texto');
      const fijo = { texto: texto.textContent, clase: boton.className };
      new MutationObserver(() => {
        if (texto.textContent !== fijo.texto) texto.textContent = fijo.texto;
        if (boton.className !== fijo.clase) boton.className = fijo.clase;
      }).observe(raiz, { subtree: true, childList: true, characterData: true, attributes: true });
    });
    const escribir = async (p, digitos, cuadrosPorDigito) => {
      for (const d of digitos) {
        await p.keyboard.type(d);
        await p.waitForTimeout(15);
        await clipActual.cuadro(cuadrosPorDigito);
      }
    };
    let clipActual = null;

    const clips = {
      // A mano: clic en cada casilla y teclear el número, como se hace hoy.
      async amano() {
        await preparar([{ ...ANA, lleno: true }]);
        const p = await abrirRaven(ANA);
        await p.evaluate(() => { document.getElementById('raven-llenar').style.display = 'none'; });
        const clip = (clipActual = new Clip(p, 'amano', temporal));
        await clip.ponerCursor(560, 420);
        await clip.quieto(0.4);
        for (let n = 1; n <= 9; n++) {
          await clip.clic(`input[name=r${n}]`, n === 1 ? 0.5 : 0.3);
          await clip.quieto(0.2);
          await p.keyboard.type(ANA.respuestas[n - 1]);
          await clip.quieto(0.35);
        }
        clip.terminar();
      },

      // Lo principal: un clic en el botón de la página y las 60 quedan escritas.
      async llenar() {
        await preparar([{ ...ANA, lleno: true }]);
        const p = await abrirRaven(ANA);
        const clip = (clipActual = new Clip(p, 'llenar', temporal));
        await clip.ponerCursor(700, 430);
        await clip.quieto(0.6);
        await clip.clic('#raven-llenar >> button', 0.9);
        await sostenerMensaje(p);
        await clip.cuadro(Math.round(1.6 * FPS));
        await clip.mover(900, 560, 0.6);
        await clip.quieto(4.8);
        clip.terminar();
      },

      // Captura en la extensión: se teclean las 60 y salta sola a la siguiente.
      async captura() {
        await preparar([{ ...ANA, lleno: false }]);
        await abrirRaven(ANA);
        const p = await abrirPopup();
        const clip = (clipActual = new Clip(p, 'captura', temporal));
        await p.locator('#r1').focus();
        await clip.quieto(0.5);
        await escribir(p, ANA.respuestas, 3);
        await p.evaluate(() => document.activeElement.blur());
        await clip.quieto(1.2);
        clip.terminar();
      },

      // Pegar la columna de Excel en la casilla 1.
      async pegar() {
        await preparar([{ ...ANA, lleno: false }]);
        await abrirRaven(ANA);
        const p = await abrirPopup();
        const clip = (clipActual = new Clip(p, 'pegar', temporal));
        await p.locator('#r1').focus();
        await clip.quieto(1);
        await p.evaluate((texto) => {
          const datos = new DataTransfer();
          datos.setData('text/plain', texto);
          document.getElementById('r1').dispatchEvent(new ClipboardEvent('paste', { clipboardData: datos, bubbles: true, cancelable: true }));
        }, ANA.respuestas.split('').join('\n'));
        await p.evaluate(() => document.activeElement.blur());
        await clip.quieto(2);
        clip.terminar();
      },

      // Grupo: cada página usa las respuestas de su candidato.
      async cola() {
        await preparar([{ ...ANA, lleno: true }, { ...BETO, lleno: true }]);
        const beto = await abrirRaven(BETO);
        let clip = (clipActual = new Clip(beto, 'cola-beto', temporal));
        await clip.ponerCursor(760, 470);
        await clip.quieto(0.8);
        await clip.clic('#raven-llenar >> button', 0.8);
        await sostenerMensaje(beto);
        await clip.cuadro(Math.round(2.2 * FPS));
        clip.terminar();
        await beto.close();

        const ana = await abrirRaven(ANA);
        clip = (clipActual = new Clip(ana, 'cola-ana', temporal));
        await clip.ponerCursor(760, 470);
        await clip.quieto(0.8);
        await clip.clic('#raven-llenar >> button', 0.8);
        await sostenerMensaje(ana);
        await clip.cuadro(Math.round(2.2 * FPS));
        clip.terminar();
      },

      // Doble captura: se teclea otra vez, la 17 no coincide y se corrige con la hoja.
      async verificar() {
        // El error de dedo está en la 1ª captura (la 17); la 2ª se teclea bien.
        const primera = ANA.respuestas.split('');
        primera[16] = primera[16] === '7' ? '1' : '7';
        await preparar([{ ...ANA, respuestas: primera.join(''), lleno: true }]);
        await abrirRaven(ANA);
        const p = await abrirPopup();
        const clip = (clipActual = new Clip(p, 'verificar', temporal));
        await clip.ponerCursor(300, 600);
        await clip.quieto(0.5);
        await clip.clic('#verificar', 0.6);
        await clip.mover(470, 330, 0.4);
        await escribir(p, ANA.respuestas, 2);
        await clip.quieto(0.6);
        await clip.clic('#verificar', 0.5);
        await clip.quieto(1.6);
        const correcto = ANA.respuestas[16];
        await p.locator('#r17').focus();
        await p.keyboard.type(correcto);
        await p.evaluate(() => document.activeElement.blur());
        await clip.quieto(1.6);
        clip.terminar();
      },
    };

    for (const [nombre, grabar] of Object.entries(clips)) {
      if (pedidos.length && !pedidos.includes(nombre)) continue;
      await cerrarTodo();
      await grabar();
    }
  } finally {
    await ctx.close();
    fs.rmSync(temporal, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
