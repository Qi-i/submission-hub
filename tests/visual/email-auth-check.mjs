import { readFileSync } from 'node:fs'

const failures = []
const theme = readFileSync('src/lib/theme.tsx', 'utf8')
const auth = readFileSync('src/lib/auth.tsx', 'utf8')
const emailAuth = readFileSync('src/lib/email-auth.ts', 'utf8')
const login = readFileSync('src/components/Login.tsx', 'utf8')
const settings = readFileSync('src/components/AccountSettingsModal.tsx', 'utf8')
const linkResult = readFileSync('src/components/AccountLinkResult.tsx', 'utf8')
const app = readFileSync('src/App.tsx', 'utf8')
const avatarMigration = readFileSync('supabase/008_profile_avatars.sql', 'utf8')
const guide = readFileSync('src/components/FirstRunGuide.tsx', 'utf8')

if (!/export type UiMode = 'luminous' \| 'luminous-x'/.test(theme)) failures.push('theme still exposes more than the two supported interfaces')
if (!/export type AccountUiMode = 'luminous' \| 'luminous-x'/.test(auth)) failures.push('account metadata still exposes Classic as a supported UI')
if (!theme.includes("value === 'classic'")) failures.push('legacy Classic preferences are not migrated')
if (!auth.includes("rawUiMode === 'classic' ? 'luminous'")) failures.push('legacy account metadata is not migrated to Luminous')
if (guide.includes('经典、Luminous') || guide.includes('经典 UI')) failures.push('onboarding still advertises the retired Classic interface')

for (const required of ['signInWithPassword', 'signInWithOtp', 'shouldCreateUser: false', 'emailRedirectTo', 'import.meta.env.BASE_URL']) {
  if (!emailAuth.includes(required)) failures.push(`email auth is missing ${required}`)
}
if (!login.includes('发送邮箱登录链接')) failures.push('login page does not expose the email-link fallback')
if (!login.includes('signUpWithEmailPassword') || !login.includes('signInWithEmailPassword')) failures.push('login page still bypasses the repaired email auth module')

for (const required of ['外显名称', '上传头像', "from('user_profiles')", 'from(AVATAR_BUCKET).upload', 'upsert: true', 'supabase.auth.updateUser', '绑定 GitHub', '设置或更新密码']) {
  if (!settings.includes(required)) failures.push(`account settings are missing ${required}`)
}
if (!settings.includes('MAX_AVATAR_BYTES') || !settings.includes('ACCEPTED_AVATAR_TYPES')) failures.push('avatar validation is incomplete')
if (!settings.includes('GITHUB_LINK_MARKER')) failures.push('GitHub linking does not persist callback intent')
if (!linkResult.includes('getUserIdentities') || !linkResult.includes('GitHub 已绑定到当前账户')) failures.push('GitHub link callback result is not verified')
if (!app.includes('AccountLinkResult')) failures.push('account link callback result is not mounted in the online app')

for (const required of ['profile-avatars', 'file_size_limit', 'allowed_mime_types', 'FOR SELECT', 'FOR INSERT', 'FOR UPDATE', 'FOR DELETE', 'WITH CHECK']) {
  if (!avatarMigration.includes(required)) failures.push(`avatar migration is missing ${required}`)
}

console.log(JSON.stringify({ failures }, null, 2))
if (failures.length) throw new Error(failures.join(' | '))
