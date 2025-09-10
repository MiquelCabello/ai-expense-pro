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
  Camera, 
  FileText, 
  Bot, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Euro,
  Calendar,
  Building2,
  Tag,
  CreditCard,
  Hash
} from 'lucide-react';

interface ExtractedData {
  vendor: string;
  expense_date: string;
  amount_gross: number;
  tax_vat: number;
  amount_net: number;
  currency: string;
  category_suggestion: string;
  payment_method_guess: string;
  project_code_guess?: string;
  notes?: string;
}

interface ReceiptUploadProps {
  onUploadComplete?: () => void;
}

const categories = [
  'Viajes',
  'Dietas', 
  'Transporte',
  'Alojamiento',
  'Material',
  'Software',
  'Otros'
];

const paymentMethods = [
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'OTHER', label: 'Otro' }
];

console.log('ReceiptUpload component being defined');

export default function ReceiptUpload({ onUploadComplete }: ReceiptUploadProps) {
  console.log('ReceiptUpload component executing');
  const { user, profile } = useAuth();
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [formData, setFormData] = useState({
    vendor: '',
    expense_date: '',
    amount_net: '',
    tax_vat: '',
    amount_gross: '',
    currency: 'EUR',
    category_id: '',
    project_code_id: '',
    payment_method: 'CARD' as const,
    notes: ''
  });
  const [categories_list, setCategoriesList] = useState<any[]>([]);
  const [projects_list, setProjectsList] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load categories and projects
  React.useEffect(() => {
    loadCategoriesAndProjects();
  }, []);

  const loadCategoriesAndProjects = async () => {
    try {
      const [categoriesRes, projectsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('project_codes').select('*').eq('status', 'ACTIVE').order('name')
      ]);

      if (categoriesRes.data) setCategoriesList(categoriesRes.data);
      if (projectsRes.data) setProjectsList(projectsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      // Create preview for images
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreview(e.target?.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  });

  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        onDrop([target.files[0]]);
      }
    };
    input.click();
  };

  const processWithAI = async () => {
    if (!file || !user) return;

    setProcessing(true);
    setStep('processing');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const response = await supabase.functions.invoke('ai-extract-expense', {
        body: formData
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Error procesando el recibo');
      }

      const extracted = response.data.data as ExtractedData;
      setExtractedData(extracted);

      // Pre-fill form with extracted data
      const categoryMatch = categories_list.find(cat => 
        cat.name === extracted.category_suggestion
      );

      setFormData({
        vendor: extracted.vendor || '',
        expense_date: extracted.expense_date || '',
        amount_net: extracted.amount_net?.toString() || '',
        tax_vat: extracted.tax_vat?.toString() || '',
        amount_gross: extracted.amount_gross?.toString() || '',
        currency: extracted.currency || 'EUR',
        category_id: categoryMatch?.id || '',
        project_code_id: '',
        payment_method: extracted.payment_method_guess as any || 'CARD',
        notes: extracted.notes || ''
      });

      setStep('review');
      toast.success('¡Recibo analizado con IA exitosamente!');

    } catch (error: any) {
      console.error('AI processing error:', error);
      toast.error(error.message || 'Error procesando el recibo con IA');
      setStep('upload');
    } finally {
      setProcessing(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;

    setUploading(true);

    try {
      // 1. Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Create file record
      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .insert({
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_key: uploadData.path,
          checksum_sha256: '', // We could calculate this if needed
          uploaded_by: user.id,
          metadata: extractedData ? { 
            ai_extracted: true, 
            raw_extraction: extractedData as any 
          } as any : {}
        })
        .select()
        .single();

      if (fileError) throw fileError;

      // 3. Create expense record
      const amountGross = parseFloat(formData.amount_gross);
      const amountNet = parseFloat(formData.amount_net);
      const taxVat = parseFloat(formData.tax_vat);

      // Generate hash for deduplication
      const hashString = `${file.name}-${formData.vendor}-${formData.expense_date}-${amountGross}`;
      const hashArray = new TextEncoder().encode(hashString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashArray);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error: expenseError } = await supabase
        .from('expenses')
        .insert({
          employee_id: user.id,
          project_code_id: formData.project_code_id || null,
          category_id: formData.category_id,
          vendor: formData.vendor,
          expense_date: formData.expense_date,
          amount_net: amountNet,
          tax_vat: taxVat,
          amount_gross: amountGross,
          currency: formData.currency,
          payment_method: formData.payment_method,
          notes: formData.notes,
          receipt_file_id: fileRecord.id,
          source: extractedData ? 'AI_EXTRACTED' : 'MANUAL',
          hash_dedupe: hashHex
        });

      if (expenseError) throw expenseError;

      // 4. Create audit log
      await supabase
        .from('audit_logs')
        .insert({
          actor_user_id: user.id,
          action: 'EXPENSE_CREATE',
          entity: 'Expense',
          entity_id: '', // We don't have the expense ID here
          metadata: {
            vendor: formData.vendor,
            amount: amountGross,
            source: extractedData ? 'AI_EXTRACTED' : 'MANUAL'
          }
        });

      toast.success('¡Gasto creado exitosamente!');
      
      // Reset form
      setStep('upload');
      setFile(null);
      setFilePreview(null);
      setExtractedData(null);
      setFormData({
        vendor: '',
        expense_date: '',
        amount_net: '',
        tax_vat: '',
        amount_gross: '',
        currency: 'EUR',
        category_id: '',
        project_code_id: '',
        payment_method: 'CARD',
        notes: ''
      });

      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error: any) {
      console.error('Error creating expense:', error);
      toast.error(error.message || 'Error creando el gasto');
    } finally {
      setUploading(false);
    }
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return isNaN(num) ? '0,00 €' : new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(num);
  };

  if (step === 'processing') {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <Bot className="h-16 w-16 text-primary mx-auto mb-4 animate-pulse" />
            <h3 className="text-2xl font-bold mb-2">Analizando Recibo con IA</h3>
            <p className="text-muted-foreground">
              Nuestro sistema está extrayendo los datos del recibo automáticamente...
            </p>
          </div>
          
          <Progress value={processing ? 75 : 0} className="mb-4" />
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando imagen con Gemini AI...
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
              <CheckCircle className="h-6 w-6 text-success" />
              Revisar Datos Extraídos
            </CardTitle>
            <CardDescription>
              La IA ha extraído estos datos. Revísalos y modifícalos si es necesario.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* File Preview */}
            {filePreview && (
              <div className="flex justify-center">
                <img 
                  src={filePreview} 
                  alt="Receipt preview" 
                  className="max-w-xs max-h-48 object-contain rounded-lg border"
                />
              </div>
            )}

            {/* AI Confidence Badge */}
            <div className="flex justify-center">
              <Badge variant="secondary" className="gap-2">
                <Bot className="h-4 w-4" />
                Extraído con IA
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Vendor */}
              <div className="space-y-2">
                <Label htmlFor="vendor" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Comercio *
                </Label>
                <Input
                  id="vendor"
                  value={formData.vendor}
                  onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
                  placeholder="Nombre del comercio"
                  required
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="expense_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Fecha del Gasto *
                </Label>
                <Input
                  id="expense_date"
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expense_date: e.target.value }))}
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Categoría *
                </Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories_list.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="payment_method" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Método de Pago *
                </Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, payment_method: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Code */}
              <div className="space-y-2">
                <Label htmlFor="project_code" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Código de Proyecto
                </Label>
                <Select
                  value={formData.project_code_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, project_code_id: value }))}
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

              {/* Currency */}
              <div className="space-y-2">
                <Label htmlFor="currency" className="flex items-center gap-2">
                  <Euro className="h-4 w-4" />
                  Moneda
                </Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  placeholder="EUR"
                />
              </div>
            </div>

            {/* Financial Details */}
            <div className="bg-muted/30 p-4 rounded-lg space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Detalles Financieros
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount_net">Importe Neto *</Label>
                  <Input
                    id="amount_net"
                    type="number"
                    step="0.01"
                    value={formData.amount_net}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount_net: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_vat">IVA</Label>
                  <Input
                    id="tax_vat"
                    type="number"
                    step="0.01"
                    value={formData.tax_vat}
                    onChange={(e) => setFormData(prev => ({ ...prev, tax_vat: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount_gross">Total *</Label>
                  <Input
                    id="amount_gross"
                    type="number"
                    step="0.01"
                    value={formData.amount_gross}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount_gross: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {formData.amount_gross && (
                <div className="text-center p-2 bg-background rounded">
                  <span className="text-lg font-bold text-primary">
                    Total: {formatCurrency(formData.amount_gross)}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales sobre el gasto..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('upload')}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                type="submit"
                disabled={uploading}
                className="flex-1 bg-gradient-primary hover:opacity-90"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Crear Gasto
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
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-6 w-6" />
          Subir Recibo
        </CardTitle>
        <CardDescription>
          Arrastra un archivo o haz clic para seleccionar. Nuestro sistema AI extraerá los datos automáticamente.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          
          {file ? (
            <div className="space-y-4">
              <FileText className="h-12 w-12 text-primary mx-auto" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {filePreview && (
                <img 
                  src={filePreview} 
                  alt="Preview" 
                  className="max-w-48 max-h-32 object-contain mx-auto rounded border"
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium">
                  {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo aquí'}
                </p>
                <p className="text-sm text-muted-foreground">
                  O haz clic para seleccionar (JPG, PNG, PDF hasta 10MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Camera Button for Mobile */}
        <div className="text-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleCameraCapture}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Capturar con Cámara
          </Button>
        </div>

        {/* Actions */}
        {file && (
          <div className="space-y-3">
            <Button
              onClick={processWithAI}
              disabled={processing}
              className="w-full bg-gradient-primary hover:opacity-90"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando con IA...
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Analizar con IA
                </>
              )}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground">
              O puedes rellenar los datos manualmente sin usar IA
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}