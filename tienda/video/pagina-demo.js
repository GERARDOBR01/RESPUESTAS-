// Página de captura para el video: misma estructura que la del Raven (etiqueta «N.-» junto a
// cada casilla, 5 series de 12), con un diseño limpio y neutro. No imita la marca de
// PsicoWeb y no trae datos reales: el candidato es ficticio.
function paginaDemo({ nombre = 'Ana López', cedula = 'AAAA000000AAAAAA01' } = {}) {
  let series = '';
  for (let c = 0; c < 5; c++) {
    series += `<section class="serie"><h3>Serie ${'ABCDE'[c]}</h3>`;
    for (let r = 1; r <= 12; r++) {
      const n = c * 12 + r;
      series += `<div class="fila"><span>${n}.-</span><input type="text" name="r${n}" autocomplete="off"></div>`;
    }
    series += '</section>';
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Raven · Introducir respuestas</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.4 Inter, system-ui, sans-serif; color: #1d2433; background: #f4f6fa; }
  .barra { height: 56px; display: flex; align-items: center; gap: 12px; padding: 0 28px;
    background: #ffffff; border-bottom: 1px solid #e3e7ef; font-weight: 600; }
  .barra small { font-weight: 500; color: #5b6475; }
  .hoja { margin: 18px 28px; padding: 18px 22px; background: #fff; border: 1px solid #e3e7ef; border-radius: 12px; }
  .datos { display: flex; gap: 28px; margin-bottom: 14px; color: #5b6475; font-size: 14px; }
  .datos b { color: #1d2433; font-weight: 600; }
  .series { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0 26px; }
  h3 { margin: 0 0 6px; font-size: 13px; color: #5b6475; font-weight: 600; border-bottom: 1px solid #e3e7ef; padding-bottom: 4px; }
  .fila { display: flex; align-items: center; gap: 10px; height: 40px; }
  .fila span { width: 34px; text-align: right; color: #5b6475; font-variant-numeric: tabular-nums; }
  input { width: 92px; height: 32px; border: 1px solid #c9d0dd; border-radius: 6px; text-align: center;
    font: 600 16px Inter, system-ui, sans-serif; color: #1d2433; background: #fff; outline: none; }
  input:focus { border-color: #1e88e5; box-shadow: 0 0 0 3px rgba(30,136,229,.18); }
  .pie { display: flex; justify-content: flex-end; margin-top: 10px; }
  .pie button { font: 600 14px Inter, system-ui, sans-serif; padding: 9px 22px; border-radius: 8px; border: 0;
    background: #1d2433; color: #fff; }
  #cursor { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483646; pointer-events: none;
    transform: translate(-100px, -100px); }
</style></head><body>
  <div class="barra">Introducir respuestas · Raven <small>Página de ejemplo, sin datos reales</small></div>
  <div class="hoja">
    <div class="datos"><span>Candidato: <b>${nombre}</b></span><span>Cédula: <b>${cedula}</b></span><span>Prueba: <b>Raven General</b></span></div>
    <div class="series">${series}</div>
    <div class="pie"><button type="button">Guardar</button></div>
  </div>
</body></html>`;
}

module.exports = { paginaDemo };
