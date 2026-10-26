import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { generateRandomCode } from '../src/lib/accessCodeGenerator'

function loadEnv(): { url: string; key: string } {
  let envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), '.env')
  }
  if (!fs.existsSync(envPath)) {
    throw new Error('.env veya .env.local dosyası bulunamadı!')
  }
  const content = fs.readFileSync(envPath, 'utf8')
  let url = ''
  let key = ''
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const [k, ...v] = trimmed.split('=')
    const val = v.join('=').trim().replace(/^["']|["']$/g, '')
    if (k.trim() === 'VITE_SUPABASE_URL') url = val
    if (k.trim() === 'SUPABASE_SERVICE_ROLE_KEY') key = val
    if (!key && k.trim() === 'VITE_SUPABASE_ANON_KEY') key = val
  }
  return { url, key }
}

async function sendCdpCommand(ws: WebSocket, method: string, params: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000)
    const onMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.id === id) {
          ws.removeEventListener('message', onMessage)
          if (msg.error) reject(new Error(msg.error.message))
          else resolve(msg.result)
        }
      } catch {
        // ignore
      }
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1. Öğrenci kodlarını çek (kod değerleri asla console'a yazdırılmaz)
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('id, full_name, student_access_code')
    .in('id', [
      '8dd1fd87-b0ab-48c3-bf64-7c0f520908d9', // Test YKS
      '7da01119-c538-4b19-b6f3-e0d733450136', // Test LGS
    ])

  if (sErr || !students || students.length === 0) {
    console.error('Öğrenciler çekilemedi:', sErr?.message)
    process.exit(1)
  }

  let yksCode = students.find((s) => s.id === '8dd1fd87-b0ab-48c3-bf64-7c0f520908d9')?.student_access_code
  let lgsCode = students.find((s) => s.id === '7da01119-c538-4b19-b6f3-e0d733450136')?.student_access_code

  if (!yksCode) {
    yksCode = generateRandomCode('STU')
    await supabase.from('students').update({ student_access_code: yksCode }).eq('id', '8dd1fd87-b0ab-48c3-bf64-7c0f520908d9')
  }
  if (!lgsCode) {
    lgsCode = generateRandomCode('STU')
    await supabase.from('students').update({ student_access_code: lgsCode }).eq('id', '7da01119-c538-4b19-b6f3-e0d733450136')
  }

  const outputDir = path.join(process.cwd(), 'docs', 'ekran')
  fs.mkdirSync(outputDir, { recursive: true })

  // 2. Vite dev sunucusunu başlat
  console.log('▶ Vite sunucusu başlatılıyor...')
  const viteProc = spawn('npx', ['vite', '--port', '5173'], {
    stdio: 'pipe',
    detached: false,
  })

  // Vite'ın hazır olmasını bekle
  await sleep(3000)

  // 3. Headless Chrome başlat
  console.log('▶ Headless Chrome başlatılıyor...')
  const chromeProc = spawn(
    'google-chrome',
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--window-size=390,844',
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-sandbox',
    ],
    { stdio: 'pipe' },
  )

  await sleep(2000)

  try {
    // Chrome CDP endpoint'e bağlan
    const verRes = await fetch('http://127.0.0.1:9222/json/version')
    const verData = (await verRes.json()) as { webSocketDebuggerUrl: string }
    const ws = new WebSocket(verData.webSocketDebuggerUrl)

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = (err) => reject(err)
    })

    // Target oluştur
    const newTarget = await sendCdpCommand(ws, 'Target.createTarget', {
      url: 'about:blank',
      width: 390,
      height: 844,
    })
    const targetWsUrl = `ws://127.0.0.1:9222/devtools/page/${newTarget.targetId}`
    const pageWs = new WebSocket(targetWsUrl)
    await new Promise<void>((resolve, reject) => {
      pageWs.onopen = () => resolve()
      pageWs.onerror = (err) => reject(err)
    })

    await sendCdpCommand(pageWs, 'Page.enable')
    await sendCdpCommand(pageWs, 'Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    })

    const targets = [
      {
        name: 'Test YKS',
        code: yksCode,
        filename: 'portal-haftam-test-yks.png',
      },
      {
        name: 'Test LGS',
        code: lgsCode,
        filename: 'portal-haftam-test-lgs.png',
      },
    ]

    for (const t of targets) {
      console.log(`▶ ${t.name} portalı yükleniyor...`)
      await sendCdpCommand(pageWs, 'Page.navigate', {
        url: `http://localhost:5173/portal?code=${encodeURIComponent(t.code)}`,
      })

      // Sayfanın oturum açıp dashboard'u çekmesini bekle
      await sleep(4000)

      // Screenshot al
      const { data: base64Data } = await sendCdpCommand(pageWs, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      })

      const filePath = path.join(outputDir, t.filename)
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
      const stat = fs.statSync(filePath)
      console.log(`✓ ${t.name} ekran görüntüsü kaydedildi: docs/ekran/${t.filename} (${stat.size} bayt)`)
    }

    pageWs.close()
    ws.close()
  } finally {
    chromeProc.kill()
    viteProc.kill()
  }
}

main().catch((err) => {
  console.error('Hata:', err)
  process.exit(1)
})
