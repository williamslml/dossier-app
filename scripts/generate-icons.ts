// Script de un solo uso para regenerar los íconos de marca (ADR 0005: los
// íconos son un paso manual). No es parte del build: se corre a mano cuando
// cambie el diseño, con `node scripts/generate-icons.mjs`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = fileURLToPath(new URL('..', import.meta.url))
const resourcesDir = `${root}/resources`
mkdirSync(resourcesDir, { recursive: true })

// Ícono de marca elegido por el usuario (resources/dossier-icon.svg):
// círculo de fondo #0B0B0C con el glifo de rama de Git en blanco, ya
// completo en el archivo (fondo + glifo juntos) — a diferencia de una
// versión anterior de este script, que armaba su propio círculo + glifo de
// Lucide por separado, acá se rasteriza el SVG tal cual viene, tamaño por
// tamaño (sharp escala con nitidez desde un viewBox de 256, no hace falta
// ningún ajuste manual de escala).
const sourceSvg = readFileSync(`${resourcesDir}/dossier-icon.svg`, 'utf8')

async function renderPng(size: number): Promise<Buffer> {
  return sharp(Buffer.from(sourceSvg), { density: 384 }).resize(size, size).png().toBuffer()
}

const icoSizes = [16, 24, 32, 48, 64, 128, 256]

async function main() {
  // Ícono para notificaciones (src/main/notify.ts): PNG simple, es lo que
  // espera la API de Notification. El tray en sí usa app-icon.ico (ver
  // src/main/index.ts) — Windows sí se beneficia de un .ico multi-tamaño
  // para la bandeja, a pesar de lo que decía este comentario antes.
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
