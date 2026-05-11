import React from 'react'
import ReactDOM from 'react-dom/client'
import '@cloudscape-design/global-styles/index.css'
import './styles/theme.css'
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
