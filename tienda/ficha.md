# Ficha para la Chrome Web Store

Todo lo que pide el formulario del panel de desarrollador
(https://chrome.google.com/webstore/devconsole), listo para copiar.

## Antes de publicar
1. Cuenta de desarrollador (pago único de US$5) con tu correo.
2. `node herramientas/licencia.js llaves` (una vez) → commit de `licencia.js`.
3. `powershell -ExecutionPolicy Bypass -File herramientas\empaquetar.ps1` → sube el .zip de `dist\`.
4. Publica `tienda/privacidad.html` en una URL pública (p. ej. GitHub Pages o tu sitio) y
   pon esa URL en «Prácticas de privacidad».
5. Visibilidad: **No listada** (solo quien tenga el enlace la puede instalar). El enlace
   se lo das al cliente junto con su clave de licencia.

> **Nombre y marcas.** «Raven» y «PsicoWeb» son marcas de terceros. La tienda rechaza a
> veces fichas que usan marcas ajenas en el nombre o el ícono. Si la rechazan, usa un
> nombre propio (p. ej. «Captura rápida de respuestas · Matrices») y menciona PsicoWeb
> solo en la descripción, como «compatible con».

> **Imágenes.** `node tienda/generar-imagenes.js` arma `tienda/imagenes/*.png` (1280×800).
> La segunda usa la página falsa de las pruebas; lo ideal es reemplazarla por una captura
> real de PsicoWeb con un candidato de prueba (sin datos reales).

## Datos de la ficha

**Nombre:** Raven · llenar respuestas

**Resumen (máx. 132 caracteres):**
Captura las 60 respuestas del Raven una vez y llénalas en PsicoWeb con un clic. Ideal para aplicaciones en grupo.

**Categoría:** Productividad / Herramientas

**Idioma:** Español (Latinoamérica)

**Descripción:**
```
Para quien captura en PsicoWeb las respuestas del Raven aplicado en papel.

• Captura las 60 respuestas en una rejilla igual a la de la página (A–E, 12 por serie):
  escribes el número y salta sola a la siguiente. También puedes pegar una columna de Excel.
• Llénalas en la página de captura con un clic, desde la extensión o con el botón que
  aparece en la página. Comprueba que la página aceptó cada valor.
• Aplicaciones en grupo: captura a todos los candidatos de una vez, cada uno con su
  cédula. Al abrir la captura de cada candidato, sus respuestas se usan solas y queda
  marcado como llenado.
• Te avisa si vas a llenar a un candidato con las respuestas de otro.
• No guarda la página por ti: tú revisas y guardas en PsicoWeb como siempre.

Privacidad: todo se queda en tu computadora. No envía datos a ningún servidor. De la
cédula solo guarda una huella y los últimos 4 caracteres, para reconocer cada captura.

Requiere una licencia. Información: Gerardo Barrera · jesusgerardobarrerasolis@gmail.com
No está afiliada a PsicoWeb ni a los titulares del test Raven.
```

## Propósito único
Capturar las respuestas del test Raven y escribirlas en la página de captura de PsicoWeb.

## Justificación de permisos
| Permiso | Para qué |
|---|---|
| `storage` | Guardar en la computadora las respuestas capturadas, la licencia y dónde quedó el botón. |
| `scripting` | Escribir las respuestas en las casillas de la página de captura cuando el usuario aprieta «Llenar página». |
| `activeTab` | Leer la dirección de la pestaña abierta para saber si es la captura del Raven y de qué cédula es. |
| Host `app.psicoweb.com` | Mostrar el botón «Llenar respuestas» en la página de captura y llenar sus casillas. No se usa en ningún otro sitio. |

**¿Usa código remoto?** No. Todo el código va en el paquete.

## Prácticas de privacidad (formulario)
- Datos que recopila: **ninguno** se transmite. Marca solo «Contenido del sitio web» si el
  formulario lo exige por leer la URL de la página de PsicoWeb; se usa localmente.
- No se venden ni transfieren datos a terceros.
- No se usan para fines ajenos al propósito único.
- No se usan para determinar solvencia ni para préstamos.
