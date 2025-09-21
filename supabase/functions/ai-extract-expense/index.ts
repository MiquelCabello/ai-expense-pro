// Ruta: supabase/functions/ai-extract-expense/index.ts
// Descripción: Edge Function con flujo de **doble pasada** a Gemini.
//  1) Clasifica (Ticket|Factura)  2) Extrae campos guiado por el tipo.
//  Temperatura 0, JSON estricto, retries y normalización con fallbacks conservadores.
//  Respuesta: { success: true, data: {...}, meta: { reason, confidence, timings } }
// Anotaciones: este archivo incluye comentarios breves (NOTE / RATIONALE / TODO).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ==========================
// Utilidades básicas de HTTP
// ==========================
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    status: init.status ?? 200,
  })

// ======================
// Tipos de la respuesta
// ======================
type DocType = 'FACTURA' | 'TICKET'

type ClassifyResult = {
  type: DocType
  reason?: string
  confidence?: number // 0..1
}

type ExtractResult = {
  vendor?: string | null
  expense_date?: string | null // YYYY-MM-DD
  amount_gross?: number | null
  tax_vat?: number | null
  amount_net?: number | null
  currency?: string | null
  category_guess?: string | null
  invoice_number?: string | null
  tax_id?: string | null
  address?: string | null
  email?: string | null
  notes?: string | null
  raw_text?: string | null
}

// ================
// Gemini helpers
// ================
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash-latest'

async function callGeminiJSON({
  apiKey,
  model,
  prompt,
  base64,
  mime,
  responseMime = 'application/json',
  retries = 2,
}: {
  apiKey: string
  model: string
  prompt: string
  base64: string
  mime: string
  responseMime?: string
  retries?: number
}): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: base64, mimeType: mime } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topP: 1,
      topK: 1,
      maxOutputTokens: 2048,
      response_mime_type: responseMime,
    },
  }

  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) throw new Error('Gemini sin contenido')
      // NOTE: robustez ante texto accesorio
      const parsed = safeJsonParseFromText(text)
      if (!parsed) throw new Error('Gemini devolvió texto no-JSON')
      return parsed
    } catch (err) {
      lastErr = err
      await sleep(200 * (i + 1))
    }
  }
  throw lastErr ?? new Error('Gemini fallo desconocido')
}

// ==========================
// Prompts de doble pasada
// ==========================
function buildClassifyPrompt(fileName: string) {
  return `Eres un clasificador de documentos de gasto. Devuelve SOLO JSON válido.\nReglas de clasificación:\n- Si ves "Factura simplificada" / "Simplified invoice" => TICKET.\n- Si aparece la palabra "Factura" o "Invoice" o hay un número de factura visible => FACTURA.\n- La presencia de CIF/NIF/VAT **no** basta por sí sola para FACTURA (los tickets pueden llevarlo).\n- En duda, elige TICKET.\nFormato EXACTO:\n{"type":"FACTURA|TICKET","reason":"...","confidence":0..1}\n\nContexto:\n- Nombre de archivo: ${fileName}\n- Si encuentras texto irrelevante, ignóralo.`
}

function buildExtractPrompt(kind: DocType) {
  const pressure =
    kind === 'FACTURA'
      ? `Prioriza extraer "invoice_number" si existe (no inventes).`
      : `No inventes "invoice_number"; déjalo null salvo que se vea claramente.`

  return `Eres un extractor de datos de ${kind.toLowerCase()}s. Devuelve SOLO JSON válido con estas claves (usa null si no aplica):\n{\n  "vendor": string|null,\n  "expense_date": string|null, // YYYY-MM-DD\n  "amount_gross": number|null,\n  "tax_vat": number|null,\n  "amount_net": number|null,\n  "currency": string|null,\n  "category_guess": string|null,\n  "invoice_number": string|null,\n  "tax_id": string|null,\n  "address": string|null,\n  "email": string|null,\n  "notes": string|null,\n  "raw_text": string|null\n}\n\nPolíticas:\n- ${pressure}\n- No alucines: si dudas, usa null.\n- "expense_date" en formato YYYY-MM-DD si puedes inferirla; si no, null.\n- Los importes son números con "." decimal.\n- "raw_text": pega solo líneas clave (CIF/NIF/VAT, Nº factura, totales, fecha), no todo el OCR.`
}

// ==========================
// Lógica principal
// ==========================
serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
    if (!GEMINI_API_KEY) return json({ success: false, error: 'Falta GEMINI_API_KEY' }, { status: 500 })

    const contentType = req.headers.get('content-type') || ''

    let file: File | undefined
    let fileUrl = ''
    let mime_type = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      file = formData.get('file') as File
      fileUrl = String(formData.get('file_url') || '')
      mime_type = String(formData.get('mime_type') || '')
    } else {
      const body = await req.json().catch(() => ({} as any))
      fileUrl = String(body?.file_url || '')
      mime_type = String(body?.mime_type || '')
    }

    if (!file && !fileUrl) return json({ success: false, error: 'No se recibió archivo ni URL' }, { status: 400 })

    const fileName = (file?.name || fileUrl.split('?')[0].split('/').pop() || 'document')

    let base64 = ''
    let mime = mime_type || 'application/octet-stream'

    if (file) {
      const r = await fileToBase64(file)
      base64 = r.base64
      mime = r.mime || mime
    } else {
      const r = await urlToBase64(fileUrl)
      base64 = r.base64
      mime = r.mime || mime
    }

    const t0 = Date.now()

    // 1) Clasificar
    const classify = await callGeminiJSON({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      prompt: buildClassifyPrompt(fileName),
      base64,
      mime,
    }) as ClassifyResult

    const detectedType: DocType = (classify?.type === 'FACTURA' ? 'FACTURA' : classify?.type === 'TICKET' ? 'TICKET' : undefined) ??
      heuristicKindFromFilename(fileName)

    // 2) Extraer
    const extract = await callGeminiJSON({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      prompt: buildExtractPrompt(detectedType),
      base64,
      mime,
    }) as ExtractResult

    const t1 = Date.now()

    // 3) Normalizar + fallbacks conservadores
    const normalized = normalizeAI(extract)

    // Fallbacks con filename si falta invoice_number
    if (!normalized.invoice_number) {
      const fromName = detectInvoiceNumber(fileName)
      if (detectedType === 'FACTURA' && fromName) normalized.invoice_number = fromName
    }

    // Tax ID con tolerancia a separadores, sin patrón genérico
    if (!normalized.tax_id) {
      const compactText = [extract.raw_text || '', extract.notes || ''].join('\n')
      const tx = detectTaxId(compactText)
      if (tx) normalized.tax_id = tx
    }

    // El tipo viene de la 1ª pasada (clasificación). Nunca lo forzamos por tax_id.
    normalized.type = detectedType
    ;(normalized as any).kind = detectedType

    const meta = {
      reason: classify?.reason || undefined,
      confidence: typeof classify?.confidence === 'number' ? classify.confidence : undefined,
      timings: { total_ms: t1 - t0 },
    }

    // NOTE: log corto para trazabilidad (puedes comentar en prod)
    console.log('[ai-extract-expense]', { type: normalized.type, reason: meta.reason, invoice_number: normalized.invoice_number })

    return json({ success: true, data: normalized, meta })
  } catch (err: any) {
    return json({ success: false, error: String(err?.message || err) }, { status: 500 })
  }
})

// ==========================
// Normalización & heurísticas
// ==========================
function normalizeAI(src: ExtractResult) {
  const vendor = (src.vendor ?? '').toString().trim()
  const expense_date = toISO(src.expense_date || '')
  const amount_gross = normalizeNumber(src.amount_gross)
  const tax_vat = normalizeNumber(src.tax_vat)
  const amount_net = normalizeNumber(src.amount_net ?? (amount_gross && tax_vat ? amount_gross - tax_vat : undefined))
  const currency = (src.currency || 'EUR').toString().trim().slice(0, 5)
  const notes = (src.notes || '').toString()
  const category_guess = (src.category_guess || '').toString() || undefined
  const address = optionalStr(src.address)
  const email = optionalStr(src.email)

  let invoice_number = sanitizeId(optionalStr(src.invoice_number))
  let tax_id = sanitizeId(optionalStr(src.tax_id))

  return {
    vendor,
    expense_date,
    amount_gross: amount_gross ?? 0,
    tax_vat: tax_vat ?? 0,
    amount_net: amount_net ?? 0,
    currency,
    category_guess,
    category_suggestion: category_guess,
    notes,
    type: 'TICKET' as DocType, // NOTE: se ajusta más arriba con la clasificación
    invoice_number: invoice_number || undefined,
    tax_id: tax_id || undefined,
    address,
    email,
  }
}

function optionalStr(v?: string | null) { return v == null ? undefined : String(v) }

function sanitizeId(v?: string) {
  if (!v) return v
  return v.trim().replace(/[\s\t]+/g, '')
}

function normalizeNumber(n: unknown): number | undefined {
  if (typeof n === 'number' && isFinite(n)) return n
  if (typeof n === 'string') {
    const s = n.replace(/\s/g, '').replace(/,/g, '.')
    const f = parseFloat(s)
    if (!isNaN(f)) return f
  }
  return undefined
}

function toISO(s: string): string {
  if (!s) return ''
  // Acepta dd/mm/yyyy ó yyyy-mm-dd
  const a = s.trim()
  const m1 = a.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/)
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`
  const m2 = a.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/)
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`
  return ''
}

function detectInvoiceNumber(text?: string): string | undefined {
  if (!text) return undefined
  const patterns: RegExp[] = [
    /factur[a|o]\s*(?:n[ºo°]\s*|n\.?\s*|num(?:ero)?\s*|#|:)?\s*([A-Z0-9][A-Z0-9_.\-\/]{2,24})/i,
    /invoice\s*(?:no\.?|number|n[ºo°]|#|:)?\s*([A-Z0-9][A-Z0-9_.\-\/]{2,24})/i,
    /\b(?:n[ºo°]|no\.|n\.)\s*(?:de\s*factura)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9_.\-\/]{3,24})/i,
    // Del filename, ej: F253282.pdf o FAC-2024-0001.jpg
    /\b([A-Z]{1,4}-?\d{3,10})\b/i,
  ]
  for (const re of patterns) { const m = text.match(re); if (m) return m[1] }
  return undefined
}

function detectTaxId(text?: string): string | undefined {
  if (!text) return undefined
  // Permite separadores; sin fallback genérico para evitar falsos positivos
  const rawPatterns: RegExp[] = [
    /\b([ABCDEFGHJKLMNPQRSUVW]\s?[.\-\s]?\d{7}\s?[.\-\s]?[A-Z0-9])\b/i, // CIF ES
    /\b(\d{8}\s?[.\-\s]?[A-Z])\b/i,                                      // NIF ES
    /\b([XYZ]\s?[.\-\s]?\d{7}\s?[.\-\s]?[A-Z])\b/i,                     // NIE ES
    /\b([A-Z]{2}\s?[.\-\s]?[A-Z0-9]{8,12})\b/i,                            // VAT UE
    /\b([A-Z&Ñ]{3,4}\s?[.\-\s]?[0-9]{6}\s?[.\-\s]?[A-Z0-9]{3})\b/i,     // RFC MX
    /\b(\d{1,3}\.\d{3}\.\d{3}-[\dkK])\b/,                               // RUT CL
    /\b(\d{2}-?\d{8}-?\d)\b/,                                             // CUIT AR
  ]
  for (const re of rawPatterns) { const m = text.match(re); if (m) return m[1].replace(/[\s.\-]/g, '') }

  const sanitized = text.replace(/[\s.\-]/g, '')
  const cleanPatterns: RegExp[] = [
    /\b([ABCDEFGHJKLMNPQRSUVW]\d{7}[A-Z0-9])\b/i,
    /\b(\d{8}[A-Z])\b/i,
    /\b([XYZ]\d{7}[A-Z])\b/i,
    /\b([A-Z]{2}[A-Z0-9]{8,12})\b/i,
    /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i,
    /\b(\d{2}\d{8}\d)\b/,
  ]
  for (const re of cleanPatterns) { const m = sanitized.match(re); if (m) return m[1] }
  return undefined
}

function heuristicKindFromFilename(name: string): DocType {
  const lower = name.toLowerCase()
  if (/factura\s+simplificada|simplified\s+invoice/.test(lower)) return 'TICKET'
  if (/invoice|factura|fac-\d|f\d{3,}/.test(lower)) return 'FACTURA'
  return 'TICKET'
}

// ==========================
// IO helpers
// ==========================
async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const buf = new Uint8Array(await file.arrayBuffer())
  return { base64: encodeBase64(buf), mime: file.type || 'application/octet-stream' }
}

async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No pude descargar ${url}`)
  const mime = res.headers.get('content-type') || 'application/octet-stream'
  const buf = new Uint8Array(await res.arrayBuffer())
  return { base64: encodeBase64(buf), mime }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[])
  }
  return btoa(binary)
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function safeJsonParseFromText(text: string) {
  // Intenta extraer el primer bloque JSON válido
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const candidate = text.slice(start, end + 1)
  try { return JSON.parse(candidate) } catch { return null }
}