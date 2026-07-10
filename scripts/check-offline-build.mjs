import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const file = resolve(process.cwd(), 'dist-offline', 'offline.html')

let html
try {
  const info = await stat(file)
  if (!info.isFile() || info.size < 10_000) throw new Error('offline.html is missing or unexpectedly small')
  html = await readFile(file, 'utf8')
} catch (error) {
  console.error(`Offline build check failed: ${error.message}`)
  process.exit(1)
}

const forbiddenCloudMarkers = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'supabase.auth',
  'supabase.functions',
  'r2-upload',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const foundMarkers = forbiddenCloudMarkers.filter(marker => html.includes(marker))
if (foundMarkers.length) {
  console.error(`Offline build contains cloud-only code: ${foundMarkers.join(', ')}`)
  process.exit(1)
}

const externalScript = /<script\b[^>]*\bsrc=(?!["']data:)["'][^"']+["']/i.test(html)
const externalStyle = /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=(?!["']data:)["'][^"']+["']/i.test(html)
if (externalScript || externalStyle) {
  console.error('Offline build still references external JavaScript or stylesheet files.')
  process.exit(1)
}

if (!html.includes('Submission Hub') || !html.includes('id="root"')) {
  console.error('Offline build does not contain the expected application shell.')
  process.exit(1)
}

console.log(`Offline build verified: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB, single-file, cloud code absent.`)
