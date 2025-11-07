// Edge Function: upload-to-dropbox
// Sube archivos a Dropbox con estructura jerárquica de 9 niveles

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadRequest {
  file_url: string
  file_name: string
  company_id: string
  user_id: string
  department_id?: string
  project_code_id: string
  category_id: string
  expense_date: string
  vendor: string
}

interface DropboxUploadResponse {
  dropbox_path: string
  dropbox_url?: string
  classification_path?: string
}

interface DropboxTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[upload-to-dropbox] Function invoked')
    
    // Verificar que tenemos los secrets necesarios
    const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')
    const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')
    const DROPBOX_REFRESH_TOKEN = Deno.env.get('DROPBOX_REFRESH_TOKEN')
    
    if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
      console.error('[upload-to-dropbox] Missing Dropbox configuration')
      throw new Error('Dropbox configuration not complete')
    }

    // Refrescar el token de acceso
    console.log('[upload-to-dropbox] Refreshing access token...')
    const authString = btoa(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`)
    
    console.log('[upload-to-dropbox] Auth request details:', {
      app_key_length: DROPBOX_APP_KEY.length,
      refresh_token_length: DROPBOX_REFRESH_TOKEN.length,
    })
    
    const tokenResponse = await fetch('https://api.dropbox.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${DROPBOX_REFRESH_TOKEN}`,
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[upload-to-dropbox] Token refresh failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText,
      })
      throw new Error(`Failed to refresh Dropbox token (${tokenResponse.status}): ${errorText}`)
    }

    const tokenData: DropboxTokenResponse = await tokenResponse.json()
    const DROPBOX_ACCESS_TOKEN = tokenData.access_token
    console.log('[upload-to-dropbox] Access token refreshed successfully:', {
      token_length: DROPBOX_ACCESS_TOKEN.length,
      expires_in: tokenData.expires_in,
    })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.57.2')
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body: UploadRequest = await req.json()
    const { 
      file_url, 
      file_name, 
      company_id, 
      user_id, 
      department_id,
      project_code_id,
      category_id,
      expense_date,
      vendor
    } = body

    console.log('[upload-to-dropbox] Processing upload:', { 
      company_id, 
      user_id, 
      department_id,
      project_code_id,
      category_id,
      expense_date,
      vendor,
      file_name,
      file_url: file_url.substring(0, 50) + '...'
    })

    // 1. Obtener información de la empresa
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('name, migrated_from_account_id')
      .eq('id', company_id)
      .single()

    if (companyError) {
      console.error('[upload-to-dropbox] Error fetching company:', companyError)
      throw new Error('Company not found')
    }

    // 2. Obtener información del usuario/empleado
    const { data: profile, error: profileError } = await supabase
      .from('profiles_v2')
      .select('email, name')
      .eq('user_id', user_id)
      .single()

    if (profileError) {
      console.error('[upload-to-dropbox] Error fetching profile:', profileError)
    }

    const employeeName = profile?.name || profile?.email?.split('@')[0] || 'unknown'

    // 3. Obtener nombre del grupo empresarial si existe
    let groupName = ''
    if (company.migrated_from_account_id) {
      const { data: account } = await supabase
        .from('accounts')
        .select('name')
        .eq('id', company.migrated_from_account_id)
        .single()
      
      if (account?.name) {
        groupName = account.name
      }
    }

    // 4. Obtener nombre del departamento si existe
    let departmentName = ''
    if (department_id) {
      const { data: department } = await supabase
        .from('departments')
        .select('name')
        .eq('id', department_id)
        .single()
      
      if (department?.name) {
        departmentName = department.name
      }
    }

    // 5. Obtener nombre del código de proyecto
    const { data: projectCode, error: projectError } = await supabase
      .from('project_codes')
      .select('code, name')
      .eq('id', project_code_id)
      .single()

    if (projectError || !projectCode) {
      console.error('[upload-to-dropbox] Error fetching project code:', projectError)
      throw new Error('Project code not found')
    }

    // 6. Obtener nombre de la categoría
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('name')
      .eq('id', category_id)
      .single()

    if (categoryError || !category) {
      console.error('[upload-to-dropbox] Error fetching category:', categoryError)
      throw new Error('Category not found')
    }

    // 7. Calcular año y trimestre
    const expenseDate = new Date(expense_date)
    const year = expenseDate.getFullYear().toString()
    const month = expenseDate.getMonth() + 1
    const quarter = `Q${Math.ceil(month / 3)}`

    // 8. Construir la ruta jerárquica de 9 niveles
    const pathParts = []
    
    // Nivel 1: Grupo empresarial (si existe)
    if (groupName) {
      pathParts.push(sanitizeFolderName(groupName))
    }
    
    // Nivel 2: Empresa (obligatorio)
    pathParts.push(sanitizeFolderName(company.name))
    
    // Nivel 3: Departamento (si existe)
    if (departmentName) {
      pathParts.push(sanitizeFolderName(departmentName))
    }
    
    // Nivel 4: Empleado (obligatorio)
    pathParts.push(sanitizeFolderName(employeeName))
    
    // Nivel 5: Código de proyecto (obligatorio)
    pathParts.push(sanitizeFolderName(projectCode.code))
    
    // Nivel 6: Categoría (obligatorio)
    pathParts.push(sanitizeFolderName(category.name))
    
    // Nivel 7: Año (obligatorio)
    pathParts.push(year)
    
    // Nivel 8: Trimestre (obligatorio)
    pathParts.push(quarter)
    
    // Nivel 9: Comercio/Vendor (obligatorio)
    pathParts.push(sanitizeFolderName(vendor))

    const dropboxPath = `/${pathParts.join('/')}/${file_name}`
    const classificationPath = pathParts.join('/')

    console.log('[upload-to-dropbox] Uploading to:', dropboxPath)
    console.log('[upload-to-dropbox] Classification path:', classificationPath)

    // 6. Descargar el archivo desde Supabase Storage
    const fileResponse = await fetch(file_url)
    if (!fileResponse.ok) {
      throw new Error('Failed to download file from storage')
    }
    const fileBuffer = await fileResponse.arrayBuffer()

    // 7. Subir a Dropbox
    const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
          mode: 'add',
          autorename: true,
          mute: false,
        }),
      },
      body: fileBuffer,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('[upload-to-dropbox] Dropbox upload failed:', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        headers: Object.fromEntries(uploadResponse.headers.entries()),
        body: errorText,
      })
      throw new Error(`Dropbox upload failed (${uploadResponse.status}): ${errorText || uploadResponse.statusText}`)
    }

    const uploadResult = await uploadResponse.json()
    console.log('[upload-to-dropbox] Upload successful:', uploadResult)

    // 8. Crear un enlace compartido para el archivo (opcional)
    let shareUrl = ''
    try {
      const shareResponse = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: dropboxPath,
          settings: {
            requested_visibility: 'public',
          },
        }),
      })

      if (shareResponse.ok) {
        const shareResult = await shareResponse.json()
        shareUrl = shareResult.url
      } else {
        // Intentar obtener un enlace existente
        const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: dropboxPath,
          }),
        })

        if (listResponse.ok) {
          const listResult = await listResponse.json()
          if (listResult.links && listResult.links.length > 0) {
            shareUrl = listResult.links[0].url
          }
        }
      }
    } catch (shareError) {
      console.error('[upload-to-dropbox] Failed to create share link:', shareError)
    }

    const response: DropboxUploadResponse = {
      dropbox_path: dropboxPath,
      dropbox_url: shareUrl,
      classification_path: classificationPath,
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[upload-to-dropbox] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

function sanitizeFolderName(name: string): string {
  // Eliminar caracteres no permitidos en nombres de carpetas de Dropbox
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
}
