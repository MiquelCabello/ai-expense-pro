// Ruta: src/components/ReceiptUpload.tsx
// Descripción: Añade modal de "Categoría sugerida" si la IA propone una que no existe.
// Mantiene:
//  - Modal previo (Empleado, Proyecto, Notas)
//  - rfId único y subida sin upsert
//  - Edge Fn con FormData (file + userId) + fallback
//  - Normalizador IA y selector Ticket/Factura
//  - Consultas resilientes (sin columna status / sin tabla employees)
// Anotaciones: degradación suave si no hay permisos para crear categorías.

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  Upload,
  Bot,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Euro,
  Calendar,
  Building2 as Building,
  Tag,
  CreditCard,
  Hash,
  Info,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ExtractedData {
  vendor: string
  expense_date: string
  amount_gross: number
  tax_vat: number
  amount_net: number
  currency: string
  category_suggestion?: string
  category_guess?: string
  payment_method_guess?: string
  project_code_guess?: string
  notes?: string
  type?: 'TICKET' | 'FACTURA' | string
  kind?: 'TICKET' | 'FACTURA' | string
  invoice_number?: string
  tax_id?: string
  address?: string
  email?: string
}

interface ReceiptUploadProps { onUploadComplete?: () => void }

// ===== Utils: IDs / parseo / normalización =====
const genId = () => (globalThis.crypto?.randomUUID?.() as string | undefined) || `rf_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`

const pickField = (obj: any, ...keys: string[]) => {
  for (const k of keys) {
    if (obj == null) break
    const parts = k.split('.')
    let cur: any = obj
    for (const p of parts) cur = cur?.[p]
    if (cur !== undefined && cur !== null && cur !== '') return cur
  }
  return undefined
}

const parseNumber = (val: any): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined
  if (typeof val === 'number' && Number.isFinite(val)) return val
  let s = String(val).trim().replace(/[^0-9,.-]/g, '')
  if (!s) return undefined
  const lastComma = s.lastIndexOf(','); const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (lastComma > -1) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

const toISODate = (val: any): string => {
  if (!val) return ''
  const s = String(val).trim()
  let m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/)
  if (m) { const [, y, mo, d] = m; return `${y}-${String(+mo).padStart(2,'0')}-${String(+d).padStart(2,'0')}` }
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/)
  if (m) { const [, d, mo, y] = m; return `${y}-${String(+mo).padStart(2,'0')}-${String(+d).padStart(2,'0')}` }
  const t = Date.parse(s)
  if (!Number.isNaN(t)) { const dt = new Date(t); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` }
  return ''
}

const normalizeAIResponse = (raw: any): ExtractedData => {
  const src = raw?.data ?? raw
  const vendor = pickField(src, 'vendor', 'merchant', 'commerce', 'company', 'company_name') ?? ''
  const expense_date = toISODate(pickField(src, 'expense_date', 'date', 'purchase_date', 'invoice_date') ?? '')
  const amount_gross = parseNumber(pickField(src, 'amount_gross', 'total', 'total_amount', 'amount')) ?? ((): number | undefined => {
    const net = parseNumber(pickField(src, 'amount_net', 'net'))
    const vat = parseNumber(pickField(src, 'tax_vat', 'vat', 'tax', 'iva'))
    return net != null && vat != null ? net + vat : undefined
  })() ?? 0
  const tax_vat = parseNumber(pickField(src, 'tax_vat', 'vat', 'tax', 'iva')) ?? 0
  const amount_net = parseNumber(pickField(src, 'amount_net', 'net')) ?? (amount_gross && tax_vat ? amount_gross - tax_vat : 0)
  const currency = (pickField(src, 'currency', 'currency_code') ?? 'EUR') as string
  const notes = (pickField(src, 'notes', 'comment', 'description') ?? '') as string
  const category_guess = (pickField(src, 'category_guess', 'category_suggestion', 'category') ?? '') as string

  const invoice_number = pickField(src, 'invoice_number', 'invoiceNo', 'invoice_no', 'n_factura')
  const tax_id = pickField(src, 'tax_id', 'cif', 'nif', 'vat_id', 'company_tax_id')
  const address = pickField(src, 'address', 'company_address')
  const email = pickField(src, 'email', 'company_email')

  const t = (pickField(src, 'type', 'kind') ?? '').toString().toUpperCase()
  const type = (invoice_number || tax_id ? 'FACTURA' : (t || 'TICKET')) as ExtractedData['type']

  return {
    vendor: String(vendor),
    expense_date,
    amount_gross: Number(amount_gross || 0),
    tax_vat: Number(tax_vat || 0),
    amount_net: Number(amount_net || 0),
    currency: String(currency || 'EUR'),
    category_guess: category_guess || undefined,
    category_suggestion: category_guess || undefined,
    notes: String(notes || ''),
    type,
    kind: type,
    invoice_number: invoice_number ? String(invoice_number) : undefined,
    tax_id: tax_id ? String(tax_id) : undefined,
    address: address ? String(address) : undefined,
    email: email ? String(email) : undefined,
  }
}

export default function ReceiptUpload({ onUploadComplete }: ReceiptUploadProps) {
  const { user, profile } = useAuth()

  const isAdmin = React.useMemo(() => {
    const roleStr = (profile as any)?.role ? String((profile as any).role).toLowerCase() : ''
    const flag = (profile as any)?.is_admin === true
    const roles = (user?.app_metadata?.roles as string[] | undefined) ?? []
    return flag || roleStr.includes('admin') || roleStr.includes('administrador') || roleStr.includes('owner') || roles.includes('admin') || roles.includes('owner')
  }, [profile, user])

  const [step, setStep] = useState<'upload' | 'review'>('upload')
  const [modalOpen, setModalOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [receiptFileId, setReceiptFileId] = useState<string | null>(null)
  const [docType, setDocType] = useState<'TICKET' | 'FACTURA'>('TICKET')

  const [selfEmployee, setSelfEmployee] = useState<any | null>(null)
  const [accountId, setAccountId] = useState<string | null>(null)
  const [projects_list, setProjectsList] = useState<any[]>([])
  const [employees_list, setEmployeesList] = useState<any[]>([])
  const [categories_list, setCategoriesList] = useState<any[]>([])
  const [categoryIndex, setCategoryIndex] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    employee_id: '',
    project_code_id: '',
    notes: '',
    vendor: '',
    expense_date: '',
    amount_net: '',
    tax_vat: '',
    amount_gross: '',
    currency: 'EUR',
    category_id: '',
    payment_method: 'CARD' as const,
    invoice_number: '',
    company_tax_id: '',
    company_address: '',
    company_email: '',
  })

  // Modal de categoría sugerida
  const [categoryPromptOpen, setCategoryPromptOpen] = useState(false)
  const [categoryProposedName, setCategoryProposedName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  const displayName =
    selfEmployee?.full_name ?? (profile as any)?.full_name ?? (profile as any)?.name ??
    (user?.user_metadata?.full_name as string | undefined) ?? (user?.user_metadata?.name as string | undefined) ??
    profile?.email ?? user?.email ?? ''

  const normalizeText = React.useCallback((s?: string) => {
    if (!s) return ''
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  }, [])

  const sortProjects = React.useCallback((list: any[]) => {
    return [...list].sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'es', { numeric: true, sensitivity: 'base' }))
  }, [])
  const sortCategories = React.useCallback((list: any[]) => {
    return [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }))
  }, [])

  const buildCategoryIndex = React.useCallback((cats: any[]) => {
    const idx: Record<string, string> = {}
    for (const c of cats) { const key = normalizeText(c.name); if (key) idx[key] = c.id }
    return idx
  }, [normalizeText])

  const fallbackCategoryId = React.useMemo(() => {
    const candidates = ['otro', 'otra', 'otros', 'other', 'misc']
    for (const c of categories_list) { const key = normalizeText(c.name); if (candidates.includes(key)) return c.id }
    return ''
  }, [categories_list, normalizeText])

  React.useEffect(() => { setCategoryIndex(buildCategoryIndex(categories_list)) }, [categories_list, buildCategoryIndex])

  // Self employee (tolerante si no existe la tabla employees)
  React.useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const { data: emp, error } = await supabase
          .from('employees')
          .select('id, full_name, user_id, account_id')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) throw error
        if (emp) { setSelfEmployee(emp); setAccountId(emp.account_id || null); setFormData((p) => ({ ...p, employee_id: emp.id })) }
        else setFormData((p) => ({ ...p, employee_id: user.id }))
      } catch { setFormData((p) => ({ ...p, employee_id: user.id })) }
    })()
  }, [user?.id])

  // project_codes (fallback si no hay columna status)
  React.useEffect(() => {
    ;(async () => {
      try {
        let q = supabase.from('project_codes').select('*').order('code'); if (accountId) q = q.eq('account_id', accountId)
        let { data, error } = await q.eq('status', 'ACTIVE')
        if (error) { let q2 = supabase.from('project_codes').select('*').order('code'); if (accountId) q2 = q2.eq('account_id', accountId); const { data: d2 } = await q2; setProjectsList(sortProjects(d2 || [])); return }
        setProjectsList(sortProjects(data || []))
      } catch {}
    })()
  }, [accountId, sortProjects])

  // categories (fallback si no hay columna status)
  React.useEffect(() => {
    ;(async () => {
      try {
        let q = supabase.from('categories').select('*').order('name'); if (accountId) q = q.eq('account_id', accountId)
        let { data, error } = await q.eq('status', 'ACTIVE')
        if (error) { let q2 = supabase.from('categories').select('*').order('name'); if (accountId) q2 = q2.eq('account_id', accountId); const { data: d2 } = await q2; setCategoriesList(sortCategories(d2 || [])); return }
        setCategoriesList(sortCategories(data || []))
      } catch {}
    })()
  }, [accountId, sortCategories])

  // employees (solo admin; tolerante si la tabla no existe o no tiene status)
  React.useEffect(() => {
    if (!isAdmin || !accountId) return
    ;(async () => {
      try {
        let q = supabase.from('employees').select('id, full_name, email, account_id, status').eq('account_id', accountId).order('full_name')
        let { data, error } = await q.eq('status', 'ACTIVE')
        if (error) {
          const { data: d2 } = await supabase.from('employees').select('id, full_name, email, account_id').eq('account_id', accountId).order('full_name')
          setEmployeesList(d2 || [])
          return
        }
        setEmployeesList(data || [])
      } catch { setEmployeesList([]) }
    })()
  }, [isAdmin, accountId])

  // Realtime
  React.useEffect(() => {
    const ch1 = supabase
      .channel('project_codes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_codes' }, (payload) => {
        try {
          const n: any = (payload as any).new; const o: any = (payload as any).old
          const ok = accountId ? (n?.account_id ?? o?.account_id) === accountId : true
          if (!ok) return
          const add = () => setProjectsList((p) => sortProjects([...p.filter((x) => x.id !== n.id), n]))
          if ((payload as any).eventType === 'DELETE') setProjectsList((p) => p.filter((x) => x.id !== o?.id))
          else add()
        } catch {}
      })
      .subscribe()

    const ch2 = supabase
      .channel('categories_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
        try {
          const n: any = (payload as any).new; const o: any = (payload as any).old
          const within = accountId ? (n?.account_id ?? o?.account_id) === accountId : true
          if (!within) return
          if ((payload as any).eventType === 'DELETE') setCategoriesList((prev) => prev.filter((c) => c.id !== o?.id))
          else setCategoriesList((prev) => sortCategories([...prev.filter((c) => c.id !== n.id), n]))
        } catch {}
      })
      .subscribe()

    return () => { try { supabase.removeChannel(ch1); supabase.removeChannel(ch2) } catch {} }
  }, [accountId, sortProjects, sortCategories])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (selectedFile.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = () => setFilePreview(reader.result as string); reader.readAsDataURL(selectedFile) }
      else setFilePreview(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, accept: { 'image/*': ['.jpg', '.jpeg', '.png'], 'application/pdf': ['.pdf'] }, maxSize: 10 * 1024 * 1024, multiple: false })

  const handleCameraCapture = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; (input as any).capture = 'environment'
    input.onchange = (e) => { const target = e.target as HTMLInputElement; if (target.files && target.files[0]) onDrop([target.files[0]]) }
    input.click()
  }

  const employeesEffective = React.useMemo(() => {
    let list = employees_list || []; const sel = formData.employee_id
    if (isAdmin && sel && !list.some((e) => e.id === sel)) list = [...list, { id: sel, full_name: displayName, email: '' }]
    return list
  }, [employees_list, formData.employee_id, isAdmin, displayName])

  const mapCategoryNameToId = React.useCallback((name?: string) => {
    const guess = normalizeText(name); if (!guess) return fallbackCategoryId
    if (categoryIndex[guess]) return categoryIndex[guess]
    for (const c of categories_list) { const key = normalizeText(c.name); if (key.startsWith(guess) || guess.startsWith(key) || key.includes(guess)) return c.id }
    return fallbackCategoryId
  }, [categoryIndex, categories_list, normalizeText, fallbackCategoryId])

  const exactCategoryIdByName = React.useCallback((name?: string) => {
    const key = normalizeText(name); if (!key) return ''
    for (const c of categories_list) { if (normalizeText(c.name) === key) return c.id }
    return ''
  }, [categories_list, normalizeText])

  const detectDocType = (ai: ExtractedData) => {
    if (ai.tax_id || ai.invoice_number) return 'FACTURA'
    const t = (ai.type || ai.kind || '').toString().toUpperCase()
    return t === 'FACTURA' ? 'FACTURA' : 'TICKET'
  }

  const processWithAI = async () => {
    if (!file || !user) return
    setProcessing(true)
    try {
      const rfId = genId(); const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase(); const filePath = `receipts/${user.id}/${rfId}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file, { contentType: file.type })
      if (uploadError) throw new Error(`UPLOAD_FAILED: ${uploadError.message}`)

      const { data: fileRecord, error: fileRecordError } = await supabase
        .from('receipt_files')
        .insert({ id: rfId, user_id: user.id, path: uploadData.path, original_name: file.name, mime_type: file.type, size: file.size })
        .select('id')
        .single()
      if (fileRecordError) throw fileRecordError
      setReceiptFileId(String(fileRecord.id))

      const { data: signed, error: signErr } = await supabase.storage.from('receipts').createSignedUrl(uploadData.path, 60 * 15)
      if (signErr || !signed?.signedUrl) throw new Error(`SIGN_URL_FAILED: ${signErr?.message || 'No signed URL'}`)

      let aiData: any = null
      try {
        const { data: sessionRes } = await supabase.auth.getSession()
        const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-extract-expense`
        const fd = new FormData()
        fd.append('file', file, file.name); fd.append('userId', user.id); fd.append('file_url', signed.signedUrl)
        fd.append('provider', 'GEMINI'); fd.append('mime_type', file.type)
        if (accountId) fd.append('account_id', accountId)
        if (formData.project_code_id) fd.append('project_code_id', formData.project_code_id)
        if (formData.notes) fd.append('notes', formData.notes)
        const res = await fetch(fnUrl, { method: 'POST', headers: { Authorization: `Bearer ${sessionRes.session?.access_token ?? ''}` }, body: fd })
        if (!res.ok) { let msg = ''; try { const j = await res.json(); msg = j?.message || j?.error || '' } catch {}; throw new Error(`FN_${msg || res.statusText}`) }
        aiData = await res.json()
      } catch (fnErr: any) {
        const { data, error } = await supabase.functions.invoke('extract-receipt', { body: { file_path: filePath, file_type: file.type } })
        if (error) throw new Error(`FN_${error.message || 'extract-receipt failed'}`)
        aiData = data
      }

      const norm = normalizeAIResponse(aiData)
      const detected = detectDocType(norm); setExtractedData(norm); setDocType(detected)

      const proposed = (norm.category_guess || norm.category_suggestion || '').trim()
      const mappedCatId = mapCategoryNameToId(proposed)
      const exactId = exactCategoryIdByName(proposed)

      // Pre-rellenar datos del formulario
      setFormData((prev) => ({
        ...prev,
        vendor: norm.vendor || prev.vendor,
        expense_date: norm.expense_date || prev.expense_date,
        amount_net: (norm.amount_net ?? prev.amount_net)?.toString?.() || prev.amount_net,
        tax_vat: (norm.tax_vat ?? prev.tax_vat)?.toString?.() || prev.tax_vat,
        amount_gross: (norm.amount_gross ?? prev.amount_gross)?.toString?.() || prev.amount_gross,
        currency: norm.currency || prev.currency,
        notes: prev.notes || norm.notes || '',
        category_id: mappedCatId || prev.category_id,
        invoice_number: norm.invoice_number || prev.invoice_number,
        company_tax_id: norm.tax_id || prev.company_tax_id,
        company_address: norm.address || prev.company_address,
        company_email: norm.email || prev.company_email,
      }))

      // Si la propuesta no existe EXACTA y mapeó a fallback → abrir modal
      const needPrompt = !!proposed && !exactId && mappedCatId === fallbackCategoryId
      if (needPrompt) {
        setCategoryProposedName(proposed)
        setCategoryPromptOpen(true)
        setModalOpen(false)
        // NO pasamos aún a review; lo haremos tras resolver el modal
      } else {
        setStep('review'); setModalOpen(false)
      }
    } catch (error: any) {
      const msg: string = String(error?.message || error)
      if (msg.startsWith('UPLOAD_FAILED')) toast.error('No se pudo subir el archivo', { description: msg })
      else if (msg.startsWith('SIGN_URL_FAILED')) toast.error('No se pudo generar el enlace seguro del archivo', { description: msg })
      else if (msg.startsWith('FN_')) toast.error('Error analizando el ticket', { description: msg.replace('FN_', '') })
      else toast.error('No se pudo procesar el ticket. Inténtalo de nuevo.')
    } finally { setProcessing(false) }
  }

  // Crear categoría de forma tolerante (con/sin columna status)
  const handleCreateCategory = async () => {
    const name = categoryProposedName.trim()
    if (!name) { toast.error('El nombre de la categoría no puede estar vacío'); return }
    setCreatingCategory(true)
    try {
      const base: any = { name, account_id: accountId || null, status: 'ACTIVE' }
      let { data, error } = await supabase.from('categories').insert(base).select('*').single()
      if (error) {
        // Reintento sin columna status
        const base2: any = { name, account_id: accountId || null }
        const { data: d2, error: e2 } = await supabase.from('categories').insert(base2).select('*').single()
        if (e2) throw e2
        data = d2
      }
      // Actualizar listas y formulario
      setCategoriesList((prev) => sortCategories([...(prev || []).filter((c) => c.id !== data!.id), data!]))
      setFormData((p) => ({ ...p, category_id: data!.id }))
      toast.success('Categoría creada y seleccionada')
      setCategoryPromptOpen(false)
      setStep('review')
    } catch (e: any) {
      toast.error('No se pudo crear la categoría', { description: e?.message })
    } finally { setCreatingCategory(false) }
  }

  const handleUseOther = () => {
    if (fallbackCategoryId) setFormData((p) => ({ ...p, category_id: fallbackCategoryId }))
    setCategoryPromptOpen(false)
    setStep('review')
  }

  const handleChooseManual = () => {
    setCategoryPromptOpen(false)
    setStep('review')
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !file) return
    try {
      setUploading(true)
      const arrayBuffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')

      let categoryId = formData.category_id
      const exists = categories_list.some((c) => c.id === categoryId)
      if (!exists) {
        const remapped = mapCategoryNameToId(extractedData?.category_suggestion || extractedData?.category_guess || '')
        if (remapped) categoryId = remapped
      }
      if (!categoryId) { toast.error('Selecciona una categoría válida'); setUploading(false); return }

      const effectiveEmployeeId = formData.employee_id || (selfEmployee?.id as string | undefined) || (user.id as string)
      const typeChosen = (extractedData?.tax_id || extractedData?.invoice_number) ? 'FACTURA' : docType

      const payload: any = {
        employee_id: effectiveEmployeeId,
        project_code_id: formData.project_code_id || null,
        category_id: categoryId,
        vendor: formData.vendor,
        expense_date: formData.expense_date,
        amount_net: Number(formData.amount_net || 0),
        tax_vat: Number(formData.tax_vat || 0),
        amount_gross: Number(formData.amount_gross || 0),
        currency: formData.currency,
        payment_method: formData.payment_method,
        notes: formData.notes,
        account_id: accountId || null,
        receipt_file_id: receiptFileId,
        source: extractedData ? 'AI_EXTRACTED' : 'MANUAL',
        hash_dedupe: hashHex,
        type: typeChosen,
        status: 'SUBMITTED',
      }

      if (typeChosen === 'FACTURA') {
        const extra = {
          invoice_number: formData.invoice_number || extractedData?.invoice_number,
          company_tax_id: formData.company_tax_id || extractedData?.tax_id,
          company_address: formData.company_address || extractedData?.address,
          company_email: formData.company_email || extractedData?.email,
        }
        for (const [k, v] of Object.entries(extra)) (payload as any)[k] = v ?? null
      }

      const { error: expenseError } = await supabase.from('expenses').insert(payload)
      if (expenseError) throw expenseError

      await supabase.from('audit_logs').insert({ actor_user_id: user.id, action: 'EXPENSE_SUBMITTED', metadata: { vendor: formData.vendor, amount: formData.amount_gross, type: typeChosen } })

      toast.success('Gasto enviado para aprobación')
      onUploadComplete?.()
    } catch (err: any) { toast.error('No se pudo crear el gasto') }
    finally { setUploading(false) }
  }

  // ===== UI =====
  if (step === 'review') {
    return (
      <form onSubmit={handleFormSubmit}>
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-6 w-6" /> Revisar Datos Extraídos</CardTitle>
            <CardDescription>La IA ha extraído estos datos. Revísalos antes de crear el gasto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {filePreview && (<div className="flex justify-center"><img src={filePreview} alt="Receipt preview" className="max-h-64 rounded-md border" /></div>)}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={docType} onValueChange={(v) => setDocType(v as 'TICKET' | 'FACTURA')}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TICKET">Ticket</SelectItem>
                    <SelectItem value="FACTURA">Factura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Empleado</Label>
                {isAdmin ? (
                  <Select value={formData.employee_id} onValueChange={(v) => setFormData((p) => ({ ...p, employee_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                    <SelectContent>
                      {employeesEffective.map((e) => (<SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>))}
                    </SelectContent>
                  </Select>
                ) : (<Input value={displayName} disabled />)}
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Hash className="h-4 w-4" /> Código de Proyecto</Label>
                <Select value={formData.project_code_id} onValueChange={(v) => setFormData((p) => ({ ...p, project_code_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar proyecto (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {projects_list.map((project) => (<SelectItem key={project.id} value={project.id}>{project.code} - {project.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">Categoría *</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {categories_list.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor" className="flex items-center gap-2"><Building className="h-4 w-4" /> Comercio *</Label>
                <Input id="vendor" value={formData.vendor} onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))} placeholder="Nombre del comercio" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense_date" className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Fecha *</Label>
                <Input id="expense_date" type="date" value={formData.expense_date} onChange={(e) => setFormData((p) => ({ ...p, expense_date: e.target.value }))} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency" className="flex items-center gap-2"><Euro className="h-4 w-4" /> Moneda</Label>
                <Input id="currency" value={formData.currency} onChange={(e) => setFormData((p) => ({ ...p, currency: e.target.value }))} placeholder="EUR" />
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              <h4 className="font-medium flex items-center gap-2"><CreditCard className="h-4 w-4" /> Detalles del importe</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount_net">Base imponible</Label>
                  <Input id="amount_net" type="number" step="0.01" value={formData.amount_net} onChange={(e) => setFormData((p) => ({ ...p, amount_net: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="tax_vat">IVA</Label>
                  <Input id="tax_vat" type="number" step="0.01" value={formData.tax_vat} onChange={(e) => setFormData((p) => ({ ...p, tax_vat: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="amount_gross">Total *</Label>
                  <Input id="amount_gross" type="number" step="0.01" value={formData.amount_gross} onChange={(e) => setFormData((p) => ({ ...p, amount_gross: e.target.value }))} required />
                </div>
              </div>
            </div>

            {docType === 'FACTURA' && (
              <div className="bg-muted/20 p-4 rounded-lg space-y-3">
                <h4 className="font-medium">Datos de factura</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="invoice_number">Nº de factura</Label>
                    <Input id="invoice_number" value={formData.invoice_number} onChange={(e) => setFormData((p) => ({ ...p, invoice_number: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="company_tax_id">CIF/NIF</Label>
                    <Input id="company_tax_id" value={formData.company_tax_id} onChange={(e) => setFormData((p) => ({ ...p, company_tax_id: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="company_address">Dirección</Label>
                    <Input id="company_address" value={formData.company_address} onChange={(e) => setFormData((p) => ({ ...p, company_address: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="company_email">Email</Label>
                    <Input id="company_email" type="email" value={formData.company_email} onChange={(e) => setFormData((p) => ({ ...p, company_email: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Información adicional" />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" /> Revisa los datos antes de crear el gasto.</div>
              <Button type="submit" disabled={uploading || categories_list.length === 0}>
                {uploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>) : (<><CheckCircle className="mr-2 h-4 w-4" /> Enviar para aprobación</>)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    )
  }

  // Página: solo subir ticket y abrir modal
  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-6 w-6" /> Seleccionar Ticket</CardTitle>
          <CardDescription>Sube un archivo (JPG, PNG o PDF, máx. 10MB). Puedes arrastrarlo o elegirlo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-muted/50' : 'hover:bg-muted/30'}`}>
            <input {...getInputProps()} />
            {!file ? (
              <div className="space-y-2">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="font-medium">{isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu ticket aquí'}</p>
                  <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Badge variant="secondary" className="gap-2"><CheckCircle className="h-4 w-4" /> {file.name}</Badge>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" onClick={open}>Seleccionar archivo</Button>
            <Button type="button" variant="outline" onClick={handleCameraCapture}>Tomar foto</Button>
          </div>
          {file && (
            <div className="space-y-3">
              <Button type="button" className="w-full" onClick={() => setModalOpen(true)} disabled={processing || uploading}>
                {processing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando con IA...</>) : (<><Bot className="mr-2 h-4 w-4" /> Analizar con IA</>)}
              </Button>
              <p className="text-xs text-center text-muted-foreground">Se abrirá una ventana para confirmar Empleado, Proyecto y Notas antes de analizar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: datos básicos antes de analizar */}
      <Dialog open={modalOpen} onOpenChange={(o) => (!processing ? setModalOpen(o) : null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar datos básicos</DialogTitle>
            <DialogDescription>Completa Empleado, Código de proyecto y Notas. Al confirmar, se subirá y analizará el ticket.</DialogDescription>
          </DialogHeader>

          {filePreview && (<div className="flex justify-center mb-4"><img src={filePreview} alt="Preview" className="max-h-48 rounded-md border" /></div>)}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">Empleado</Label>
              {isAdmin ? (
                <Select value={formData.employee_id} onValueChange={(v) => setFormData((p) => ({ ...p, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                  <SelectContent>
                    {employeesEffective.map((e) => (<SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>))}
                  </SelectContent>
                </Select>
              ) : (<Input value={displayName} disabled />)}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Hash className="h-4 w-4" /> Código de Proyecto</Label>
              <Select value={formData.project_code_id} onValueChange={(v) => setFormData((p) => ({ ...p, project_code_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proyecto (opcional)" /></SelectTrigger>
                <SelectContent>
                  {projects_list.map((project) => (<SelectItem key={project.id} value={project.id}>{project.code} - {project.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes"><Tag className="h-4 w-4 inline mr-1" /> Notas</Label>
              <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} placeholder="Información adicional" />
            </div>
          </div>

          {processing && (
            <div className="mt-4 space-y-2">
              <Progress value={66} />
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analizando con IA…</div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={processing}>Cancelar</Button>
            <Button type="button" onClick={processWithAI} disabled={processing || !file}>
              {processing ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando…</>) : ('Confirmar y analizar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: categoría sugerida por IA */}
      <Dialog open={categoryPromptOpen} onOpenChange={(o) => setCategoryPromptOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Info className="h-5 w-5" /> Categoría no encontrada</DialogTitle>
            <DialogDescription>
              La IA sugiere una categoría que no existe todavía. ¿Quieres crearla ahora o usar "Otra"?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label htmlFor="proposedCat">Categoría propuesta</Label>
            <Input id="proposedCat" value={categoryProposedName} onChange={(e) => setCategoryProposedName(e.target.value)} placeholder="Ej. Transporte" />
            {!fallbackCategoryId && (
              <p className="text-xs text-muted-foreground">Sugerencia: crea una categoría "Otra" en Configuración para tener un fallback.</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button type="button" variant="outline" onClick={handleChooseManual}>Elegir manualmente</Button>
            {fallbackCategoryId && (
              <Button type="button" variant="secondary" onClick={handleUseOther}>Usar "Otra"</Button>
            )}
            <Button type="button" onClick={handleCreateCategory} disabled={creatingCategory}>
              {creatingCategory ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando…</>) : ('Crear y usar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
