import React from 'react'
import ReactDOM from 'react-dom/client'
import './journal-library-runtime-fixes'
import './app-styles'
import App from './App'
import {
  collectQiHubReadOnlySnapshot,
  listQiHubPrivateAttachmentCandidates,
  readQiHubPrivateAttachment,
  compareAndSetQiHubPaperNotes,
} from './integrations/qihubReadOnlySnapshot'
import { mutateQiHubResearchTopic } from './integrations/qihubResearchTopicCrud'

// Only the real QiHub Android WebView defines the native snapshot channel.
// Keep all Supabase authentication inside this source application; native
// receives records, never password/session/refresh credentials.
if ('QiHubNativeSnapshot' in window) {
  Object.defineProperty(window, '__qihubReadOnlySnapshot', {
    value: collectQiHubReadOnlySnapshot,
    configurable: false,
  })
}
if ('QiHubNativeAttachment' in window) {
  Object.defineProperty(window, '__qihubVerifiedAttachment', {
    value: Object.freeze({
      list: listQiHubPrivateAttachmentCandidates,
      read: readQiHubPrivateAttachment,
    }),
    configurable: false,
  })
}
if ('QiHubNativePaperEdit' in window) {
  Object.defineProperty(window, '__qihubCasPaperNotes', {
    value: compareAndSetQiHubPaperNotes, configurable: false,
  })
}
if ('QiHubNativeTopicCrud' in window) {
  Object.defineProperty(window, '__qihubResearchTopicCrud', {
    value: mutateQiHubResearchTopic, configurable: false,
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
