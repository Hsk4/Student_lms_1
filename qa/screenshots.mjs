// Drives headless Chromium over CDP to capture app screens.
// usage: node qa/screenshots.mjs [name ...]
//
// Output lands in qa/screenshots/<name>.png (or <name>-m.png for the mobile
// viewport, SHOT_MOBILE=1). Browser profiles go to qa/.tmp and are deleted
// after each run, so the folder never grows into a junk drawer.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CHROME = join(
  homedir(),
  'AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe',
)
const BASE = process.env.SHOT_BASE ?? 'http://localhost:3000'
/** Screenshots are a deliverable and live in their own folder, not in `.next`. */
const OUT = 'qa/screenshots'
const TMP = 'qa/.tmp'

const freePort = () =>
  new Promise((res) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port
      s.close(() => res(p))
    })
  })

mkdirSync(OUT, { recursive: true })
mkdirSync(TMP, { recursive: true })

const port = await freePort()
const profile = join(TMP, '.profile')
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--enable-unsafe-swiftshader',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const waitFor = async (fn, ms = 15000) => {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const v = await fn()
      if (v) return v
    } catch (error) {
      void error
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('timeout')
}

const version = await waitFor(async () => {
  const r = await fetch(`http://127.0.0.1:${port}/json/version`)
  return r.ok ? r.json() : null
})

// Minimal CDP client over the browser websocket.
const ws = new WebSocket(version.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) reject(new Error(JSON.stringify(msg.error)))
    else resolve(msg.result)
  }
}
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }))
  })

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', {
  targetId,
  flatten: true,
})
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable')
await S('Runtime.enable')
await S('Network.enable')

/**
 * Refuse to shoot the wrong app.
 *
 * If something else owns :3000, `next dev` silently moves to :3001 and every
 * screenshot would be of a different project. Each marker below is rendered by
 * this repo and by nothing else; a missing one means stop, not "carry on".
 */
const HOME_MARKER = 'Approving assigns the role' // only /admin/requests renders this
const landing = await fetch(`${BASE}/admin/requests`, {
  headers: { cookie: '__session=demo_admin' },
}).then((r) => r.text())
if (!landing.includes(HOME_MARKER)) {
  console.error(`\n${BASE} is not serving this app — no "${HOME_MARKER}" on /admin/requests.`)
  console.error('If next dev moved to another port, point the harness at it:')
  console.error('  $env:SHOT_BASE = "http://localhost:3001"; node qa/screenshots.mjs')
  process.exit(1)
}

const viewport = process.env.SHOT_MOBILE
  ? { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }
  : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }
await S('Emulation.setDeviceMetricsOverride', viewport)

/**
 * `SHOT_THEME=dark` seeds the same key `lib/theme.ts` reads before paint.
 * The default run seeds `light` explicitly: with no stored choice the boot
 * script and lib/theme.ts fall back to `system`, and a machine with a dark OS
 * would then produce dark "default" screenshots.
 */
const SHOT_THEME = process.env.SHOT_THEME === 'dark' ? 'dark' : 'light'
const seedTheme = async () => {
  await S('Page.navigate', { url: BASE + '/sign-in' })
  await new Promise((r) => setTimeout(r, 500))
  const r = await S('Runtime.evaluate', {
    expression: `localStorage.setItem('lms-theme', ${JSON.stringify(SHOT_THEME)})`,
    returnByValue: true,
  })
  void r
}
await seedTheme()

let demoRole = null

/**
 * Demo session for a seeded account, if one is configured. Kept for parity
 * with older harnesses; the normal path is `setRole`, which signs in through
 * the API and stores the bearer token.
 */
const assertDemo = async () => {
  if (!demoRole) return
  const token = await S('Runtime.evaluate', {
    expression: 'localStorage.getItem("lms-auth-token")',
    returnByValue: true,
  })
  if (!token.result.value) throw new Error(`No session for ${demoRole}`)
}

const signInAs = async (role) => {
  const upper = role.toUpperCase()
  const email = process.env[`SHOT_${upper}_EMAIL`] ?? process.env.SHOT_EMAIL
  const password = process.env[`SHOT_${upper}_PASSWORD`] ?? process.env.SHOT_PASSWORD
  if (!email || !password) {
    throw new Error(`Set SHOT_${upper}_EMAIL / SHOT_${upper}_PASSWORD to capture ${role} pages`)
  }

  const res = await fetch(`${process.env.SHOT_API_URL ?? 'http://localhost:4000/api/v1'}/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const payload = await res.json().catch(() => null)
  if (!res.ok || !payload?.ok || !payload.data?.token) {
    throw new Error(`Sign-in failed for ${role}: ${payload?.error ?? res.status}`)
  }
  return payload.data
}

const setRole = async (role) => {
  demoRole = role
  // Tokens are per user; clear the previous run's session and cookies first.
  await S('Network.clearBrowserCookies')
  await S('Page.navigate', { url: BASE + '/sign-in' })
  await new Promise((r) => setTimeout(r, 500))
  if (!role) return
  const { token, user } = await signInAs(role)
  await S('Runtime.evaluate', {
    expression: `localStorage.setItem('lms-auth-token', ${JSON.stringify(token)});
      localStorage.setItem('lms-auth-user', ${JSON.stringify(JSON.stringify(user ?? null))})`,
    returnByValue: true,
  })
}

const navigate = async (url) => {
  await S('Page.navigate', { url })
  for (let attempt = 0; attempt < 4; attempt++) {
    await waitFor(async () => {
      const r = await S('Runtime.evaluate', {
        expression:
          'document.readyState === "complete" && !location.pathname.startsWith("/sign-in") && document.body.innerText.trim().length > 0',
        returnByValue: true,
      })
      return r.result.value
    })
    await new Promise((r) => setTimeout(r, 2500))
    // The session can be dropped by navigation; put the token back.
    await assertDemo()
    const r = await S('Runtime.evaluate', {
      expression: 'location.pathname',
      returnByValue: true,
    })
    if (r.result.value.startsWith(new URL(url).pathname)) return
    await S('Page.navigate', { url })
  }
}

const shoot = async (name) => {
  const { data } = await S('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  // Only the non-default theme gets a suffix, so `06-admin-users.png` stays the
  // light capture and `06-admin-users-dark.png` is its dark counterpart.
  const suffix = `${process.env.SHOT_MOBILE ? '-m' : ''}${SHOT_THEME === 'dark' ? '-dark' : ''}`
  const path = join(OUT, `${name}${suffix}.png`)
  writeFileSync(path, Buffer.from(data, 'base64'))
  const t = await S('Runtime.evaluate', {
    expression: 'document.title + " | " + location.pathname',
    returnByValue: true,
  })
  console.log(`shot ${path}  (${t.result.value})`)
}


const pages = [
  ['01-home', '/', null],
  ['02-sign-in', '/sign-in', null],
  ['03-sign-up', '/sign-up', null],
  ['04-admin-dashboard', '/admin', 'admin'],
  ['05-admin-requests', '/admin/requests', 'admin'],
  ['06-admin-users', '/admin/users', 'admin'],
  ['07-admin-courses', '/admin/courses', 'admin'],
  ['08-admin-analytics', '/admin/analytics', 'admin'],
  ['09-admin-enrollments', '/admin/enrollments', 'admin'],
  ['10-admin-audit-log', '/admin/audit-log', 'admin'],
  ['11-admin-books', '/admin/books', 'admin'],
  ['12-teacher-dashboard', '/teacher', 'teacher'],
  ['13-teacher-classes', '/teacher/classes', 'teacher'],
  ['14-teacher-assignments', '/teacher/assignments', 'teacher'],
  ['15-teacher-attendance', '/teacher/attendance', 'teacher'],
  ['16-teacher-students', '/teacher/students', 'teacher'],
  ['17-teacher-meetings', '/teacher/meetings', 'teacher'],
  ['18-student-dashboard', '/student', 'student'],
  ['19-student-courses', '/student/courses', 'student'],
  ['20-student-assignments', '/student/assignments', 'student'],
  ['21-student-quizzes', '/student/quizzes', 'student'],
  ['22-student-materials', '/student/materials', 'student'],
  ['23-student-attendance', '/student/attendance', 'student'],
  ['24-student-invoices', '/student/invoices', 'student'],
  ['25-parent-dashboard', '/parent', 'parent'],
  ['26-parent-children', '/parent/children', 'parent'],
  ['27-parent-invoices', '/parent/invoices', 'parent'],
  ['28-parent-meetings', '/parent/meetings', 'parent'],
]
const wanted = process.argv.slice(2)
let currentRole
for (const [name, path, role] of pages) {
  if (wanted.length && !wanted.includes(name)) continue
  try {
    if (role !== currentRole) {
      await setRole(role)
      currentRole = role
    }
    await navigate(BASE + path)
    await shoot(name)
  } catch (e) {
    console.log(`FAILED ${name}: ${e.message}`)
  }
}

ws.close()
chrome.kill()
try {
  rmSync(profile, { recursive: true, force: true })
  // Drop the scratch dir too when it is empty, so `qa/` holds only deliverables.
  rmSync(TMP, { recursive: true, force: true })
} catch (error) {
  // Chromium can still hold the profile for a moment on Windows; the folder is
  // git-ignored, and the next run reuses it.
  console.log("note: scratch profile not removed yet:", error.message)
}
process.exit(0)
