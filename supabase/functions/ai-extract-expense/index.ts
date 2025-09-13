// ...existing code...
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
};

interface ExpenseExtraction {
  vendor: string;
  expense_date: string;
  amount_gross: number;
  tax_vat: number;
  amount_net: number;
  currency: string;
  category_suggestion: string;
  payment_method_guess: string | null;
  project_code_guess: string | null;
  notes: string | null;
}

async function sha256Hex(buffer: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string | null;

    if (!file || !userId) {
      throw new Error('File and userId are required');
    }

    console.log(JSON.stringify({
      event: 'ai-extract:start',
      filename: file.name,
      size: file.size,
      type: file.type,
      userId
    }));

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Tipo de archivo no válido. Solo se permiten JPG, PNG y PDF.');
    }

    if (file.size > maxSize) {
      throw new Error('El archivo es demasiado grande. Máximo 10MB.');
    }

    // Read bytes and compute checksum (idempotencia básica - lectura solamente)
    const bytes = await file.arrayBuffer();
    const checksum = await sha256Hex(bytes);

    // Check existing file record by checksum (read-only, no schema changes)
    const { data: existingFiles, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('checksum_sha256', checksum)
      .limit(1);

    if (filesError) {
      console.warn('Warning checking existing files by checksum', filesError);
    }

    if (existingFiles && existingFiles.length > 0) {
      const fileRecord = existingFiles[0];
      // Try to find an expense already linked to this file
      const { data: existingExpenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('receipt_file_id', fileRecord.id)
        .limit(1);

      if (existingExpenses && existingExpenses.length > 0) {
        // Return existing expense data to avoid duplicate processing
        console.log('Found existing expense linked to checksum, returning it (idempotent response).', { expenseId: existingExpenses[0].id });
        return new Response(JSON.stringify({
          success: true,
          idempotent: true,
          data: existingExpenses[0]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Convert file to base64
    // Use robust base64 conversion
    const uint8 = new Uint8Array(bytes);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);

    // Prepare Gemini API request
    const prompt = `Eres un sistema experto financiero especializado en extraer datos de tickets y recibos españoles. 
    Analiza esta imagen y extrae la información financiera de forma precisa.
    
    INSTRUCCIONES CRÍTICAS:
    - Devuelve ÚNICAMENTE JSON válido, sin texto adicional
    - Usa formato decimal con punto (ejemplo: 12.50)
    - Las fechas en formato YYYY-MM-DD
    - Si hay múltiples fechas, prioriza la fecha de la transacción/compra
    - Para el IVA, calcula basándose en los datos del ticket
    - amount_net + tax_vat debe ser igual a amount_gross
    - Para categorías, elige entre: Viajes, Dietas, Material, Software, Transporte, Alojamiento, Otros
    - Si no encuentras un dato, usa valores por defecto razonables
    - Limpia y normaliza el nombre del vendor (sin caracteres especiales innecesarios)
    
    Responde con esta estructura JSON exacta:`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }, {
          inlineData: {
            mimeType: file.type,
            data: base64
          }
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            vendor: { type: "string" },
            expense_date: { type: "string" },
            amount_gross: { type: "number" },
            tax_vat: { type: "number" },
            amount_net: { type: "number" },
            currency: { type: "string" },
            category_suggestion: { 
              type: "string",
              enum: ["Transporte", "Viajes", "Dietas", "Material", "Software", "Alojamiento", "Otros"]
            },
            payment_method_guess: {
              type: "string", 
              enum: ["CARD", "CASH", "TRANSFER", "OTHER"]
            },
            project_code_guess: { type: "string" },
            notes: { type: "string" }
          },
          required: ["vendor", "expense_date", "amount_gross", "tax_vat", "amount_net", "currency", "category_suggestion", "payment_method_guess"]
        }
      },
      systemInstruction: {
        parts: [{
          text: "You are a financial AI system that extracts expense data from receipts. Always respond with valid JSON only."
        }]
      }
    };

    console.log('Calling Gemini API...');

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response:', geminiData);

    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      throw new Error('Invalid Gemini API response format');
    }

    let extractedData: ExpenseExtraction;
    try {
      const responseText = geminiData.candidates[0].content.parts[0].text;
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    // Validate and normalize extracted data
    if (!extractedData.vendor || !extractedData.expense_date || !extractedData.amount_gross) {
      throw new Error('Missing required fields in AI extraction');
    }

    // Financial validation
    const calculatedGross = extractedData.amount_net + (extractedData.tax_vat || 0);
    const difference = Math.abs(calculatedGross - extractedData.amount_gross);
    
    if (difference > 0.01) {
      console.warn(`Financial inconsistency detected: net(${extractedData.amount_net}) + vat(${extractedData.tax_vat}) != gross(${extractedData.amount_gross})`);
      // Auto-correct: recalculate net amount
      extractedData.amount_net = extractedData.amount_gross - (extractedData.tax_vat || 0);
    }

    // Set defaults
    extractedData.currency = extractedData.currency || 'EUR';
    extractedData.vendor = extractedData.vendor.trim();
    
    console.log('Successfully extracted expense data:', extractedData);

    return new Response(JSON.stringify({
      success: true,
      data: extractedData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-extract-expense function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      details: (error as Error).stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});