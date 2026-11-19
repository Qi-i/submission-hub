import React from 'react'
import ReactDOM from 'react-dom/client'
import './journal-library-runtime-fixes'
import './app-styles'
import App from './App'
import { collectQiHubReadOnlySnapshot } from './integrations/qihubReadOnlySnapshot'

// Only the real QiHub Android WebView defines the native snapshot channel.
// Keep all Supabase authentication inside this source application; native
// receives records, never password/session/refresh credentials.
if ('QiHubNativeSnapshot' in window) {
  Object.defineProperty(window, '__qihubReadOnlySnapshot', {
    value: collectQiHubReadOnlySnapshot,
    configurable: false,
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
