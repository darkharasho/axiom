import React from 'react'
import ReactDOM from 'react-dom/client'
// Order matters: axi.css declares the tokens, accents.css overrides
// --axi-accent per [data-axi-accent], the two theme files restate the token
// set per [data-axi-theme], and this app's own stylesheet comes last.
import '@axiapps/axi-design/axi.css'
import '@axiapps/axi-design/accents.css'
import '@axiapps/axi-design/themes/flat.css'
import '@axiapps/axi-design/themes/glass.css'
import './styles/globals.css'
import App from './App'
import { applyTheme, readAccent, applySurface, readSurface } from './themes/applyTheme'

// Before render, so the first paint is already correct.
applyTheme(readAccent())
applySurface(readSurface())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
