import React from 'react'
import ReactDOM from 'react-dom/client'
import './journal-library-runtime-fixes'
import './app-styles'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
