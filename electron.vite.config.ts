import preact from '@preact/preset-vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

// docs/adr/0002-target-electron-vite-para-electron-45.md: el mapa interno de
// electron-vite 6 no llega a Electron 45, hay que fijar el target a mano.
const TARGET = { node: 'node24.22', chrome: 'chrome156' }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { target: TARGET.node },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { target: TARGET.node },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [preact()],
    build: { target: TARGET.chrome },
  },
})
