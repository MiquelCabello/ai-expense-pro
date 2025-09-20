import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
} from 'lucide-react';

interface ExtractedData {
  vendor: string;
  expense_date: string;
  amount_gross: number;
  tax_vat: number;
  amount_net: number;
  currency: string;
  category_suggestion?: string;
  category_guess?: string;
  payment_method_guess?: string;
  project_code_guess?: string;
  notes?: string;
  type?: 'TICKET' | 'FACTURA' | string;
  kind?: 'TICKET' | 'FACTURA' | string;
  invoice_number?: string;
  tax_id?: string;
  address?: string;
  email?: string;
}

interface ReceiptUploadProps {
  onUploadComplete?: () => void;
}

export default function ReceiptUpload({ onUploadComplete }: ReceiptUploadProps) {
  const { user, profile } = useAuth();

  const isAdmin = React.useMemo(() => {
    const roleStr = (profile as any)?.role ? String((profile as any).role).toLowerCase() : '';
    const flag = (profile as any)?.is_admin === true;
    const roles = (user?.app_metadata?.roles as string[] | undefined) ?? [];
    return (
      flag ||
      roleStr.includes('admin') ||
      roleStr.includes('administrador') ||
      roleStr.includes('owner') ||
      roles.includes('admin') ||
      roles.includes('owner')
    );
  }, [profile, user]);

  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [receiptFileId, setReceiptFileId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    employee_id: '',
    vendor: '',
    expense_date: '',
    amount_net: '',
    tax_vat: '',
    amount_gross: '',
    currency: 'EUR',
    category_id: '',
    project_code_id: '',
    payment_method: 'CARD' as const,
    notes: '',
  });

  const [selfEmployee, setSelfEmployee] = useState<any | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [projects_list, setProjectsList] = useState<any[]>([]);
  const [employees_list, setEmployeesList] = useState<any[]>([]);
  const [categories_list, setCategoriesList] = useState<any[]>([]);
  const [categoryIndex, setCategoryIndex] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const displayName =
    selfEmployee?.full_name ??
    (profile as any)?.full_name ??
    (profile as any)?.name ??
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    profile?.email ??
    user?.email ??
    '';

  const sortProjects = React.useCallback((list: any[]) => {
    return [...list].sort((a, b) => {
      const ac = (a.code || '').toString();
      const bc = (b.code || '').toString();
      return ac.localeCompare(bc, 'es', { numeric: true, sensitivity: 'base' });
    });
  }, []);

  const sortCategories = React.useCallback((list: any[]) => {
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
  }, []);

  const normalize = React.useCallback((s?: string) => {
    if (!s) return '';
    return s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }, []);

  const buildCategoryIndex = React.useCallback((cats: any[]) => {
    const idx: Record<string, string> = {};
    for (const c of cats) {
      const key = normalize(c.name);
      if (key) idx[key] = c.id;
    }
    return idx;
  }, [normalize]);

  const fallbackCategoryId = React.useMemo(() => {
    const candidates = ['otro', 'otra', 'otros', 'other', 'misc'];
    for (const c of categories_list) {
      const key = normalize(c.name);
      if (candidates.includes(key)) return c.id;
    }
    return '';
  }, [categories_list, normalize]);

  React.useEffect(() => {
    setCategoryIndex(buildCategoryIndex(categories_list));
  }, [categories_list, buildCategoryIndex]);

  React.useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data: emp } = await supabase
          .from('employees')
          .select('id, full_name, user_id, account_id, status')
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .maybeSingle();
        if (emp) {
          setSelfEmployee(emp);
          setAccountId(emp.account_id || null);
          setFormData((p) => ({ ...p, employee_id: emp.id }));
        } else {
          setFormData((p) => ({ ...p, employee_id: user.id }));
        }
      } catch {
        setFormData((p) => ({ ...p, employee_id: user.id }));
      }
    })();
  }, [user?.id]);

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = accountId
          ? await supabase
              .from('project_codes')
              .select('*')
              .eq('status', 'ACTIVE')
              .eq('account_id', accountId)
              .order('code')
          : await supabase
              .from('project_codes')
              .select('*')
              .eq('status', 'ACTIVE')
              .order('code');
        setProjectsList(data || []);
      } catch {}
    })();
  }, [accountId]);

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = accountId
          ? await supabase
              .from('categories')
              .select('*')
              .eq('status', 'ACTIVE')
              .eq('account_id', accountId)
              .order('name')
          : await supabase
              .from('categories')
              .select('*')
              .eq('status', 'ACTIVE')
              .order('name');
        setCategoriesList(sortCategories(data || []));
      } catch {}
    })();
  }, [accountId, sortCategories]);

  React.useEffect(() => {
    if (!isAdmin || !accountId) return;
    (async () => {
      const { data } = await supabase
        .from('employees')
        .select('id, full_name, email, status, account_id')
        .eq('status', 'ACTIVE')
        .eq('account_id', accountId)
        .order('full_name');
      setEmployeesList(data || []);
    })();
  }, [isAdmin, accountId]);

  React.useEffect(() => {
    const channel = supabase
      .channel('project_codes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_codes' }, (payload) => {
        try {
          const n: any = (payload as any).new;
          const o: any = (payload as any).old;
          const ok = accountId ? (n?.account_id ?? o?.account_id) === accountId : true;
          if (!ok) return;
          if ((payload as any).eventType === 'INSERT') {
            if (n?.status === 'ACTIVE') setProjectsList((p) => sortProjects([...p.filter((x) => x.id !== n.id), n]));
          } else if ((payload as any).eventType === 'UPDATE') {
            const was = o?.status === 'ACTIVE';
            const is = n?.status === 'ACTIVE';
            if (is) setProjectsList((p) => sortProjects([...p.filter((x) => x.id !== n.id), n]));
            else if (was && !is) setProjectsList((p) => p.filter((x) => x.id !== n.id));
          } else if ((payload as any).eventType === 'DELETE') {
            if (o?.id) setProjectsList((p) => p.filter((x) => x.id !== o.id));
          }
        } catch {}
      })
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [accountId, sortProjects]);

  React.useEffect(() => {
    const channel = supabase
      .channel('categories_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, (payload) => {
        try {
          const n: any = (payload as any).new;
          const o: any = (payload as any).old;
          const within = accountId ? (n?.account_id ?? o?.account_id) === accountId : true;
          if (!within) return;
          setCategoriesList((prev) => {
            let next = prev;
            if ((payload as any).eventType === 'INSERT') {
              if (n?.status === 'ACTIVE') next = sortCategories([...prev.filter((c) => c.id !== n.id), n]);
            } else if ((payload as any).eventType === 'UPDATE') {
              const was = o?.status === 'ACTIVE';
              const is = n?.status === 'ACTIVE';
              if (is) next = sortCategories([...prev.filter((c) => c.id !== n.id), n]);
              else if (was && !is) next = prev.filter((c) => c.id !== n.id);
            } else if ((payload as any).eventType === 'DELETE') {
              next = prev.filter((c) => c.id !== o?.id);
            }
            const stillValid = next.some((c) => c.id === formData.category_id);
            if (!stillValid) {
              const fb = fallbackCategoryId;
              setFormData((p) => ({ ...p, category_id: fb }));
            }
            return next;
          });
        } catch {}
      })
      .subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [accountId, sortCategories, formData.category_id, fallbackCategoryId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setFilePreview(reader.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    (input as any).capture = 'environment';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) onDrop([target.files[0]]);
    };
    input.click();
  };

  const employeesEffective = React.useMemo(() => {
    let list = employees_list || [];
    const sel = formData.employee_id;
    if (isAdmin && sel && !list.some((e) => e.id === sel)) {
      list = [...list, { id: sel, full_name: displayName, email: '' }];
    }
    return list;
  }, [employees_list, formData.employee_id, isAdmin, displayName]);

  const mapCategoryNameToId = React.useCallback(
    (name?: string) => {
      const guess = normalize(name);
      if (!guess) return fallbackCategoryId;
      if (categoryIndex[guess]) return categoryIndex[guess];
      for (const c of categories_list) {
        const key = normalize(c.name);
        if (key.startsWith(guess) || guess.startsWith(key) || key.includes(guess)) return c.id;
      }
      return fallbackCategoryId;
    },
    [categoryIndex, categories_list, normalize, fallbackCategoryId]
  );

  const detectDocType = (ai: ExtractedData) => {
    const t = (ai.type || ai.kind || '').toString().toUpperCase();
    if (t === 'TICKET' || t === 'FACTURA') return t;
    if (ai.invoice_number || ai.tax_id) return 'FACTURA';
    return 'TICKET';
  };

  const processWithAI = async () => {
    if (!file || !user) return;
    setProcessing(true);
    setStep('processing');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `receipts/${user.id}/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: fileRecord, error: fileRecordError } = await supabase
        .from('receipt_files')
        .insert({
          user_id: user.id,
          path: uploadData.path,
          original_name: file.name,
          mime_type: file.type,
          size: file.size,
        })
        .select('id')
        .single();
      if (fileRecordError) throw fileRecordError;
      setReceiptFileId(String(fileRecord.id));
      const { data: aiResponse, error: aiError } = await supabase.functions.invoke('extract-receipt', {
        body: { file_path: uploadData.path, file_type: file.type },
      });
      if (aiError) throw aiError;
      const aiData = aiResponse as ExtractedData;
      setExtractedData(aiData);

      const catGuess = aiData.category_suggestion || aiData.category_guess || (aiData as any).category;
      const mappedCatId = mapCategoryNameToId(catGuess);

      setFormData((prev) => ({
        ...prev,
        vendor: aiData.vendor || prev.vendor,
        expense_date: aiData.expense_date || prev.expense_date,
        amount_net: (aiData.amount_net ?? prev.amount_net)?.toString?.() || prev.amount_net,
        tax_vat: (aiData.tax_vat ?? prev.tax_vat)?.toString?.() || prev.tax_vat,
        amount_gross: (aiData.amount_gross ?? prev.amount_gross)?.toString?.() || prev.amount_gross,
        currency: aiData.currency || prev.currency,
        notes: aiData.notes || prev.notes,
        category_id: mappedCatId || prev.category_id,
      }));

      setStep('review');
    } catch (error: any) {
      toast.error('No se pudo procesar el ticket. Inténtalo de nuevo.');
      setStep('upload');
    } finally {
      setProcessing(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) return;
    try {
      setUploading(true);
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      let categoryId = formData.category_id;
      const exists = categories_list.some((c) => c.id === categoryId);
      if (!exists) {
        const remapped = mapCategoryNameToId(extractedData?.category_suggestion || extractedData?.category_guess || '');
        if (remapped) categoryId = remapped;
      }
      if (!categoryId) {
        toast.error('No se ha podido asignar categoría. Crea "Otro" en Configuración o selecciona una.');
        setUploading(false);
        return;
      }

      const effectiveEmployeeId = formData.employee_id || selfEmployee?.id || user.id;
      const docType = extractedData ? detectDocType(extractedData) : 'TICKET';

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
        type: docType,
        status: 'SUBMITTED',
      };

      if (docType === 'FACTURA' && extractedData) {
        const extra = {
          invoice_number: extractedData.invoice_number,
          company_tax_id: extractedData.tax_id,
          company_address: extractedData.address,
          company_email: extractedData.email,
        };
        for (const [k, v] of Object.entries(extra)) {
          (payload as any)[k] = v ?? null;
        }
      }

      const { error: expenseError } = await supabase.from('expenses').insert(payload);
      if (expenseError) throw expenseError;

      await supabase.from('audit_logs').insert({
        actor_user_id: user.id,
        action: 'EXPENSE_SUBMITTED',
        metadata: { vendor: formData.vendor, amount: formData.amount_gross, type: docType },
      });

      toast.success('Gasto enviado para aprobación');
      onUploadComplete?.();
    } catch (err: any) {
      toast.error('No se pudo crear el gasto');
    } finally {
      setUploading(false);
    }
  };

  if (step === 'processing') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" /> Procesando Ticket
          </CardTitle>
          <CardDescription>
            Analizando el archivo con IA para extraer los datos relevantes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={66} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Procesando imagen con IA...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'review' && extractedData) {
    return (
      <form onSubmit={handleFormSubmit}>
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" /> Revisar Datos Extraídos
            </CardTitle>
            <CardDescription>La IA ha extraído estos datos. Revísalos antes de crear el gasto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {filePreview && (
              <div className="flex justify-center">
                <img src={filePreview} alt="Receipt preview" className="max-h-64 rounded-md border" />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">Empleado</Label>
                {isAdmin ? (
                  <Select
                    value={formData.employee_id}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, employee_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar empleado" />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesEffective.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name || e.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={displayName} disabled />
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Código de Proyecto
                </Label>
                <Select
                  value={formData.project_code_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, project_code_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proyecto (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects_list.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">Categoría *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories_list.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor" className="flex items-center gap-2">
                  <Building className="h-4 w-4" /> Comercio *
                </Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vendor: e.target.value }))}
                  placeholder="Nombre del comercio"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Fecha *
                </Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expense_date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency" className="flex items-center gap-2">
                  <Euro className="h-4 w-4" /> Moneda
                </Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData((prev) => ({ ...prev, currency: e.target.value }))}
                  placeholder="EUR"
                />
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Detalles del importe
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount_net">Base imponible</Label>
                  <Input
                    id="amount_net"
                    type="number"
                    step="0.01"
                    value={formData.amount_net}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount_net: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="tax_vat">IVA</Label>
                  <Input
                    id="tax_vat"
                    type="number"
                    step="0.01"
                    value={formData.tax_vat}
                    onChange={(e) => setFormData((prev) => ({ ...prev, tax_vat: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="amount_gross">Total *</Label>
                  <Input
                    id="amount_gross"
                    type="number"
                    step="0.01"
                    value={formData.amount_gross}
                    onChange={(e) => setFormData((prev) => ({ ...prev, amount_gross: e.target.value }))}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Información adicional"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" /> Revisa los datos antes de crear el gasto.
              </div>
              <Button type="submit" disabled={uploading || categories_list.length === 0}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" /> Enviar para aprobación
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-6 w-6" /> Seleccionar Ticket
          </CardTitle>
          <CardDescription>
            Sube un archivo (JPG, PNG o PDF, máx. 10MB). Puedes arrastrarlo o elegirlo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-muted/50' : 'hover:bg-muted/30'
            }`}
          >
            <input {...getInputProps()} />
            {!file ? (
              <div className="space-y-2">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="font-medium">
                    {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu ticket aquí'}
                  </p>
                  <p className="text-sm text-muted-foreground">o haz clic para seleccionar</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <Badge variant="secondary" className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {file.name}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" onClick={open}>
              Seleccionar archivo
            </Button>
            <Button type="button" variant="outline" onClick={handleCameraCapture}>
              Tomar foto
            </Button>
          </div>
          {file && (
            <div className="space-y-3">
              <Button type="button" className="w-full" onClick={processWithAI} disabled={processing || uploading}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando con IA...
                  </>
                ) : (
                  <>
                    <Bot className="mr-2 h-4 w-4" /> Analizar con IA
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">O puedes rellenar los datos manualmente sin usar IA</p>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Información del Gasto</CardTitle>
          <CardDescription>Completa los datos previos al análisis o selección.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">Empleado</Label>
            {isAdmin ? (
              <Select
                value={formData.employee_id}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={displayName || 'Seleccionar empleado'} />
                </SelectTrigger>
                <SelectContent>
                  {employeesEffective.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name || e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={displayName} disabled />
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Hash className="h-4 w-4" /> Código de Proyecto
            </Label>
            <Select
              value={formData.project_code_id}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, project_code_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proyecto (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {projects_list.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tag className="h-4 w-4" /> Notas adicionales
            </Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Añade contexto o instrucciones"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
