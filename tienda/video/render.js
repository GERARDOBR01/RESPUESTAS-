// Renderiza los dos formatos con HyperFrames y deja el audio a -15 LUFS / -1.5 dBTP (redes y
// YouTube) en dist/video/. Antes: node tienda/video/grabar.js y node tienda/video/armar.js.
// Uso: node tienda/video/render.js [horizontal|vertical]
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SALIDA = path.resolve(__dirname, '..', '..', 'dist', 'video');
const FORMATOS = { horizontal: 'raven-demo-16x9.mp4', vertical: 'raven-demo-9x16.mp4' };
const META = 'I=-15:TP=-1.5:LRA=11';

// Primera pasada de loudnorm: lo que mide del audio (lo imprime en stderr como JSON).
function medir(archivo) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', archivo, '-vn', '-af', `loudnorm=${META}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  return JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/s.exec(r.stderr)[0]);
}

fs.mkdirSync(SALIDA, { recursive: true });
const pedidos = process.argv.slice(2);
for (const [carpeta, nombre] of Object.entries(FORMATOS)) {
  if (pedidos.length && !pedidos.includes(carpeta)) continue;
  const crudo = path.join(SALIDA, nombre.replace('.mp4', '-crudo.mp4'));
  const final = path.join(SALIDA, nombre);
  execFileSync('npx', ['hyperframes', 'render', '--quality', 'delivery', '--output', crudo], { cwd: path.join(__dirname, carpeta), stdio: 'inherit' });
  // Segunda pasada con lo medido; lineal (sin comprimir) cuando el pico lo permite.
  const m = medir(crudo);
  const filtro = `loudnorm=${META}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
    `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', crudo, '-c:v', 'copy', '-af', filtro,
    '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final]);
  fs.rmSync(crudo);
  const f = medir(final);
  console.log(`dist/video/${nombre} · ${f.input_i} LUFS · pico ${f.input_tp} dBTP`);
}
