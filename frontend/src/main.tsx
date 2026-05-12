import React from 'react'
import ReactDOM from 'react-dom/client'
import '@cloudscape-design/global-styles/index.css'
import './styles/theme-modern.css'
import './styles/layout-fixes.css'
import './styles/theme.css'
import './styles/theme-enhanced.css'
import './styles/theme-professional.css'
import './styles/animations.css'
import './styles/utilities.css'
import './styles/cards.css'
import './styles/indicators.css'
import './styles/responsive.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast/ToastContext'
import { ToastContainer } from './components/Toast/Toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ToastContainer />
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
