// Edge Function: delete-from-dropbox
// Elimina archivos de Dropbox cuando se rechaza o elimina un gasto

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteRequest {
  dropbox_path: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[delete-from-dropbox] Function invoked')
    
    // Verificar que tenemos los secrets necesarios
    const DROPBOX_APP_KEY = Deno.env.get('DROPBOX_APP_KEY')
    const DROPBOX_APP_SECRET = Deno.env.get('DROPBOX_APP_SECRET')
    const DROPBOX_REFRESH_TOKEN = Deno.env.get('DROPBOX_REFRESH_TOKEN')
    
    if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
      console.error('[delete-from-dropbox] Missing Dropbox configuration')
      throw new Error('Dropbox configuration not complete')
    }

    // Refrescar el token de acceso
    console.log('[delete-from-dropbox] Refreshing access token...')
    const authString = btoa(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`)
    
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
      console.error('[delete-from-dropbox] Token refresh failed:', errorText)
      throw new Error(`Failed to refresh Dropbox token: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    const DROPBOX_ACCESS_TOKEN = tokenData.access_token
    console.log('[delete-from-dropbox] Access token refreshed successfully')

    const body: DeleteRequest = await req.json()
    const { dropbox_path } = body

    if (!dropbox_path) {
      throw new Error('dropbox_path is required')
    }

    console.log('[delete-from-dropbox] Deleting file:', dropbox_path)

    // Eliminar archivo de Dropbox
    const deleteResponse = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: dropbox_path,
      }),
    })

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()
      console.error('[delete-from-dropbox] Dropbox delete failed:', errorText)
      
      // Si el archivo no existe, considerarlo como éxito
      if (errorText.includes('path/not_found')) {
        console.log('[delete-from-dropbox] File not found in Dropbox (already deleted?)')
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'File not found (already deleted)',
            dropbox_path 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
      
      throw new Error(`Dropbox delete failed: ${errorText}`)
    }

    const deleteResult = await deleteResponse.json()
    console.log('[delete-from-dropbox] Delete successful:', deleteResult)

    return new Response(
      JSON.stringify({ 
        success: true,
        dropbox_path,
        metadata: deleteResult 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('[delete-from-dropbox] Error:', error)
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
