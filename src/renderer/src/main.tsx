import { render } from 'preact'
import { App } from './features/principal/App.tsx'

const root = document.getElementById('app')
if (!root) {
  throw new Error('No se encontró #app en index.html')
}
render(<App />, root)
