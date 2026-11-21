// Script de un solo uso para regenerar los íconos de marca (ADR 0005: los
// íconos son un paso manual). No es parte del build: se corre a mano cuando
// cambie el diseño, con `node scripts/generate-icons.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = fileURLToPath(new URL('..', import.meta.url))
const resourcesDir = `${root}/resources`
mkdirSync(resourcesDir, { recursive: true })

// Mismo glifo que #icon-git-branch en src/renderer/index.html (lucide
// git-branch), para que la bandeja y la ventana compartan el ícono del
// título. Colores: los reales de la marca dentro de la app (no el azul de
// acento, que solo marca "cuenta activa") — el mismo glifo se ve en
// #171717 sobre fondo claro en el title bar (`.title-bar-left { color:
// #171717 }`, `stroke="currentColor"`); el ícono invierte eso: fondo
// #171717, glifo blanco.
const glyph = `
  <line x1="6" x2="6" y1="3" y2="15" />
  <circle cx="18" cy="6" r="3" />
  <circle cx="6" cy="18" r="3" />
  <path d="M18 9a9 9 0 0 1-9 9" />
`

function svg(size) {
  // El glifo original es un viewBox 24x24; se escala a ~60% del lienzo y se
  // centra, dejando margen para que no se vea apretado en tamaños chicos.
  const scale = (size * 0.6) / 24
  const offset = (size - 24 * scale) / 2
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#171717" />
    <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      ${glyph}
    </g>
  </svg>`
}

async function renderPng(size) {
  return sharp(Buffer.from(svg(size)))
    .png()
    .toBuffer()
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256]

async function main() {
  // Ícono de bandeja (electron-menubar `icon`): PNG simple, Windows no
  // necesita un .ico para el tray.
  const trayPng = await renderPng(32)
  writeFileSync(`${resourcesDir}/tray-icon.png`, trayPng)

  // Ícono de la ventana/taskbar (BrowserWindow `icon`): PNG de buena
  // resolución, suficiente para Alt-Tab y la barra de tareas.
  const windowPng = await renderPng(256)
  writeFileSync(`${resourcesDir}/app-icon.png`, windowPng)

  // Ícono del instalador/exe (electron-builder `win.icon`): .ico multi-tamaño.
  const icoBuffers = await Promise.all(icoSizes.map(renderPng))
  const ico = await pngToIco(icoBuffers)
  writeFileSync(`${resourcesDir}/app-icon.ico`, ico)

  console.log('Íconos generados en resources/: tray-icon.png, app-icon.png, app-icon.ico')
}

main()
