// Ruta: supabase/functions/ai-extract-expense/index.ts
// Descripción: Edge Function (Gemini) con detección reforzada
//  - Acepta FormData (file + userId) o JSON (file_url)
//  - Pide JSON y también usa texto bruto (raw_text)
//  - Detecta tax_id con y sin separadores; detecta invoice_number desde texto
//  - Regla: FACTURA si tax_id || invoice_number; si no, TICKET
//  - Devuelve { success: true, data }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    status: init.status ?? 200,
  })

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return { base64: btoa(bin), mime: file.type || 'application/octet-stream' }
}

async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FETCH_FILE_URL_FAILED:${res.status}`)
  const mime = res.headers.get('content-type') || 'application/octet-stream'
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return { base64: btoa(bin), mime }
}

function normalizeNumber(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined
  if (typeof val === 'number' && Number.isFinite(val)) return val
  let s = String(val).trim().replace(/[^0-9,.-]/g, '')
  if (!s) return undefined
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (lastComma > -1) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

function toISO(val: unknown): string {
  if (!val) return ''
  const s = String(val)
  let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/)
  if (m) { const [, y, mo, d] = m; return `${y}-${String(+mo).padStart(2,'0')}-${String(+d).padStart(2,'0')}` }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m) { const [, d, mo, y] = m; return `${y}-${String(+mo).padStart(2,'0')}-${String(+d).padStart(2,'0')}` }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) { const dt = new Date(t); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` }
  return ''
}

function pick(obj: any, ...keys: string[]) {
  for (const k of keys) {
    const parts = k.split('.')
    let cur = obj
    for (const p of parts) cur = cur?.[p]
    if (cur !== undefined && cur !== null && cur !== '') return cur
  }
  return undefined
}

// === Detección fiscal ===
function detectTaxId(text?: string): string | undefined {
  if (!text) return undefined
  // 1) Patrones que permiten espacios/guiones/puntos
  const rawPatterns: RegExp[] = [
    /\b([ABCDEFGHJKLMNPQRSUVW]\s?[.\-\s]?\d{7}\s?[.\-\s]?[A-Z0-9])\b/i, // CIF
    /\b(\d{8}\s?[.\-\s]?[A-Z])\b/i,                                      // NIF
    /\b([XYZ]\s?[.\-\s]?\d{7}\s?[.\-\s]?[A-Z])\b/i,                     // NIE
    /\b([A-Z]{2}\s?[.\-\s]?[A-Z0-9]{8,12})\b/i,                            // VAT UE (ESB..., ES B ...)
    /\b([A-Z&Ñ]{3,4}\s?[.\-\s]?[0-9]{6}\s?[.\-\s]?[A-Z0-9]{3})\b/i,     // RFC MX
    /\b(\d{1,3}\.\d{3}\.\d{3}-[\dkK])\b/,                               // RUT CL
    /\b(\d{2}-?\d{8}-?\d)\b/,                                             // CUIT AR
  ]
  for (const re of rawPatterns) { const m = text.match(re); if (m) return m[1].replace(/[\s.\-]/g, '') }

  // 2) Versión sin separadores
  const sanitized = text.replace(/[\s.\-]/g, '')
  const cleanPatterns: RegExp[] = [
    /\b([ABCDEFGHJKLMNPQRSUVW]\d{7}[A-Z0-9])\b/i,
    /\b(\d{8}[A-Z])\b/i,
    /\b([XYZ]\d{7}[A-Z])\b/i,
    /\b([A-Z]{2}[A-Z0-9]{8,12})\b/i,
    /\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/i,
    /\b(\d{2}\d{8}\d)\b/,
    /\b([A-Z0-9]{8,15})\b/i,
  ]
  for (const re of cleanPatterns) { const m = sanitized.match(re); if (m) return m[1] }
  return undefined
}

function detectInvoiceNumber(text?: string): string | undefined {
  if (!text) return undefined
  const patterns: RegExp[] = [
    /factur[a|o]\s*(?:n[ºo°]\s*|n\.?\s*|num(?:ero)?\s*|#|:)?\s*([A-Z0-9][A-Z0-9_.\-\/]{2,24})/i,
    /invoice\s*(?:no\.?|number|n[ºo°]|#|:)?\s*([A-Z0-9][A-Z0-9_.\-\/]{2,24})/i,
    /\b(?:n[ºo°]|no\.|n\.)\s*(?:de\s*factura)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9_.\-\/]{3,24})/i,
  ]
  for (const re of patterns) { const m = text.match(re); if (m) return m[1] }
  return undefined
}

// === Normalización ===
function normalizeAI(raw: any, rawText?: string) {
  const src = raw?.data ?? raw
  const vendor = pick(src, 'vendor', 'merchant', 'commerce', 'company', 'company_name') ?? ''
  const expense_date = toISO(pick(src, 'expense_date', 'date', 'purchase_date', 'invoice_date') ?? '')
  const amount_gross = normalizeNumber(pick(src, 'amount_gross', 'total', 'total_amount', 'amount')) ?? 0
  const tax_vat = normalizeNumber(pick(src, 'tax_vat', 'vat', 'tax', 'iva')) ?? 0
  const amount_net = normalizeNumber(pick(src, 'amount_net', 'net')) ?? (amount_gross && tax_vat ? amount_gross - tax_vat : 0)
  const currency = (pick(src, 'currency', 'currency_code') ?? 'EUR') as string
  const notes = (pick(src, 'notes', 'comment', 'description') ?? '') as string
  const category_guess = (pick(src, 'category_guess', 'category_suggestion', 'category') ?? '') as string

  let invoice_number = pick(src, 'invoice_number', 'invoiceNo', 'invoice_no', 'n_factura')
  let tax_id = pick(src, 'tax_id', 'cif', 'nif', 'vat_id', 'company_tax_id', 'fiscal_id', 'rfc', 'rut', 'cuit')

  const possibleText = [pick(src, 'raw_text', 'full_text', 'text'), notes, rawText].filter(Boolean).join('\n')
  if (!invoice_number) invoice_number = detectInvoiceNumber(possibleText)
  if (!tax_id) tax_id = detectTaxId(possibleText)

  const address = pick(src, 'address', 'company_address')
  const email = pick(src, 'email', 'company_email')

  const type = (invoice_number || tax_id) ? 'FACTURA' : 'TICKET'

  return {
    vendor: String(vendor || ''),
    expense_date,
    amount_gross: Number(amount_gross || 0),
    tax_vat: Number(tax_vat || 0),
    amount_net: Number(amount_net || 0),
    currency: String(currency || 'EUR'),
    category_guess: category_guess || undefined,
    category_suggestion: category_guess || undefined,
    notes: String(notes || ''),
    type, kind: type,
    invoice_number: invoice_number ? String(invoice_number) : undefined,
    tax_id: tax_id ? String(tax_id) : undefined,
    address: address ? String(address) : undefined,
    email: email ? String(email) : undefined,
  }
}

// === Gemini ===
async function callGemini(args: { base64: string; mime: string; apiKey: string }) {
  const { base64, mime, apiKey } = args
  const prompt = `Eres un extractor de datos de tickets/facturas.
Devuelve SOLO un objeto JSON con EXACTAMENTE estas claves (si no sabes alguna, usa null):
{
  "vendor": string|null,
  "expense_date": string|null, // YYYY-MM-DD si puedes
  "amount_gross": number|null,
  "tax_vat": number|null,
  "amount_net": number|null,
  "currency": string|null,
  "category_guess": string|null,
  "invoice_number": string|null, // ej. F253282, 2024/001, FAC-2024-0001
  "tax_id": string|null,         // CIF/NIF/NIE/VAT/RFC/RUT/CUIT
  "address": string|null,
  "email": string|null,
  "raw_text": string|null        // pega aquí el texto relevante (CIF/NIF/VAT, Nº factura, etc.)
}`
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const body = { contents: [ { parts: [ { text: prompt }, { inline_data: { mime_type: mime, data: base64 } } ] } ], generationConfig: { temperature: 0 } }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`GEMINI_${res.status}`)
  const j = await res.json()
  const txt: string = j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || ''
  const match = txt.match(/```json[\s\S]*?```/i) || txt.match(/\{[\s\S]*\}$/)
  const jsonStr = match ? match[0].replace(/```json|```/g, '').trim() : txt
  let parsed: any = null
  try { parsed = JSON.parse(jsonStr) } catch { parsed = { raw_text: txt } }
  const rawText = typeof parsed?.raw_text === 'string' ? parsed.raw_text : txt
  return { structured: parsed, rawText }
}

// === server ===
serve(async (req) => {
  try {
    const auth = req.headers.get('authorization') || ''
    if (!auth.startsWith('Bearer ')) return json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const ct = req.headers.get('content-type') || ''
    let file: File | null = null
    let userId = ''
    let fileUrl = ''
    let mime_type = ''

    if (ct.includes('multipart/form-data')) {
      const form = await req.formData()
      file = form.get('file') as File | null
      userId = String(form.get('userId') || '')
      fileUrl = String(form.get('file_url') || '')
      mime_type = String(form.get('mime_type') || (file?.type ?? ''))
    } else {
      const body = await req.json().catch(() => ({}))
      userId = String(body.userId || body.user_id || '')
      fileUrl = String(body.file_url || body.url || body.filePath || '')
      mime_type = String(body.mime_type || body.file_type || '')
    }

    if ((!file && !fileUrl) || !userId) {
      return json({ success: false, error: 'File and userId are required' }, { status: 400 })
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) return json({ success: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    let base64 = ''
    let mime = mime_type || 'application/octet-stream'
    if (file) { const r = await fileToBase64(file); base64 = r.base64; mime = r.mime || mime }
    else { const r = await urlToBase64(fileUrl); base64 = r.base64; mime = r.mime || mime }

    const { structured, rawText } = await callGemini({ base64, mime, apiKey: GEMINI_API_KEY })
    const data = normalizeAI(structured, rawText)

    return json({ success: true, data })
  } catch (err: any) {
    return json({ success: false, error: String(err?.message || err) }, { status: 500 })
  }
})
