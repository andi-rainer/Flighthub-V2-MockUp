import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AppProvider } from './state'
import { SessionProvider } from './session/session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <SessionProvider>
          <App />
        </SessionProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
)
