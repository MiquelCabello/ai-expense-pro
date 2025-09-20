// Ruta: supabase/functions/extract-receipt/index.ts
// Descripción: Edge Function que descarga el archivo (Storage o FormData), llama a Gemini y devuelve JSON normalizado.
// Anotaciones: Usa SERVICE ROLE para leer Storage y errores con código.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ——— Utils ———
const cors = (origin?: string) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const normalizeCurrency = (cur?: string) =>
  (cur || "EUR").toString().trim().toUpperCase().slice(0, 3);

const parseNumber = (n: unknown): number | undefined => {
  if (typeof n === "number" && isFinite(n)) return n;
  if (typeof n === "string") {
    const s = n.replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
    const v = Number(s);
    return isFinite(v) ? v : undefined;
  }
  return undefined;
};

const toISODate = (input?: string): string | undefined => {
  if (!input) return undefined;
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const yRaw = m[3];
    const y = yRaw.length === 2 ? (Number(yRaw) < 50 ? "20" + yRaw : "19" + yRaw) : yRaw;
    return `${y}-${mo}-${d}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return undefined;
};

const detectDocType = (ai: any): "TICKET" | "FACTURA" => {
  const t = (ai?.type || ai?.kind || "").toString().toUpperCase();
  if (t === "TICKET" || t === "FACTURA") return t as any;
  if (ai?.invoice_number || ai?.tax_id) return "FACTURA";
  return "TICKET";
};

const safeJsonParse = (text: string): any => {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const slice = text.slice(first, last + 1);
    try {
      return JSON.parse(slice);
    } catch {}
    const cleaned = slice
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```$/i, "")
      .replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned);
  }
  return JSON.parse(text);
};

// ——— Gemini ———
async function callGemini(apiKey: string, fileBytes: Uint8Array, mime: string) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const base64 = base64Encode(fileBytes);
  const prompt =
    "Analiza si es ticket o factura y devuelve SOLO JSON. Estructura: {" +
    "type:'TICKET|FACTURA',vendor:string,expense_date:'YYYY-MM-DD',currency:'ISO'," +
    "amount_gross:number,amount_net:number,tax_vat:number,category_guess:string," +
    "invoice_number?:string,tax_id?:string,address?:string,email?:string,notes?:string}";

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }],
      },
    ],
    generationConfig: { response_mime_type: "application/json" },
  } as any;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw { code: "GEMINI_ERROR", status: res.status, detail: errText };
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try {
    return safeJsonParse(text);
  } catch (e) {
    throw { code: "PARSE_ERROR", detail: String(e) };
  }
}

// ——— Body reader: JSON (Storage) o multipart (archivo directo) ———
async function readFileFromRequest(
  req: Request,
  sb: ReturnType<typeof createClient>,
) {
  const ctype = req.headers.get("content-type")?.toLowerCase() || "";
  if (ctype.includes("application/json")) {
    const { file_path, file_type } = await req.json();
    if (!file_path) throw { code: "BAD_REQUEST", detail: "file_path required" };
    const { data: blob, error } = await sb.storage.from("receipts").download(file_path);
    if (error || !blob)
      throw { code: "DOWNLOAD_ERROR", detail: error?.message || "download failed" };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, mime: file_type || blob.type || "application/octet-stream" };
  }
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, mime: file.type || "application/octet-stream" };
    }
    const file_path = form.get("file_path")?.toString();
    const file_type = form.get("file_type")?.toString();
    if (file_path) {
      const { data: blob, error } = await sb.storage
        .from("receipts")
        .download(file_path);
      if (error || !blob)
        throw { code: "DOWNLOAD_ERROR", detail: error?.message || "download failed" };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { bytes, mime: file_type || blob.type || "application/octet-stream" };
    }
    throw { code: "BAD_REQUEST", detail: "file or file_path required" };
  }
  throw { code: "BAD_REQUEST", detail: "unsupported content-type" };
}

// ——— Handler ———
serve(async (req) => {
  const origin = req.headers.get("origin") || undefined;
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apiKey)
      return new Response(JSON.stringify({ error: "MISSING_GEMINI_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });
    if (!supabaseUrl || !serviceRole)
      return new Response(JSON.stringify({ error: "MISSING_SUPABASE_ENV" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors(origin) },
      });

    const supabase = createClient(supabaseUrl, serviceRole);

    const { bytes, mime } = await readFileFromRequest(req, supabase);

    // Si llegamos aquí, la descarga ya funcionó → ahora sí llama a Gemini
    const ai = await callGemini(apiKey, bytes, mime);

    const out: any = {};
    out.type = detectDocType(ai);
    out.vendor = (ai.vendor || "").toString().trim();
    out.expense_date = toISODate(ai.expense_date) || undefined;
    out.currency = normalizeCurrency(ai.currency);

    const g = parseNumber(ai.amount_gross);
    const n = parseNumber(ai.amount_net);
    const v = parseNumber(ai.tax_vat);

    if (out.type === "FACTURA") {
      out.amount_net =
        typeof n === "number"
          ? n
          : typeof g === "number" && typeof v === "number"
          ? g - v
          : undefined;
      out.tax_vat = typeof v === "number" ? v : undefined;
      out.amount_gross =
        typeof g === "number"
          ? g
          : typeof n === "number" && typeof v === "number"
          ? n + v
          : undefined;
      out.invoice_number = (ai.invoice_number || "").toString().trim() || undefined;
      out.tax_id = (ai.tax_id || "").toString().trim() || undefined;
      out.address = (ai.address || "").toString().trim() || undefined;
      out.email = (ai.email || "").toString().trim() || undefined;
    } else {
      out.amount_gross = typeof g === "number" ? g : undefined;
      out.amount_net = typeof n === "number" ? n : undefined;
      out.tax_vat = typeof v === "number" ? v : undefined;
    }

    const cat =
      (ai.category_suggestion ||
        ai.category_guess ||
        (ai as any).category ||
        ""
      ).toString().trim();
    out.category_guess = cat;
    out.category_suggestion = cat;
    out.project_code_guess =
      (ai.project_code_guess || (ai as any).project_code || "")
        .toString()
        .trim() || undefined;
    out.notes = (ai.notes || "").toString();

    return new Response(JSON.stringify(out), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors(origin) },
    });
  } catch (e: any) {
    const code = e?.code || "UNEXPECTED";
    const status = e?.status || 500;
    const detail = e?.detail || e?.message || String(e);
    return new Response(JSON.stringify({ error: code, detail }), {
      status,
      headers: { "Content-Type": "application/json", ...cors(origin) },
    });
  }
});
