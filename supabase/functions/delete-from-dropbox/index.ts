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
    
    const DROPBOX_ACCESS_TOKEN = Deno.env.get('DROPBOX_ACCESS_TOKEN')
    if (!DROPBOX_ACCESS_TOKEN) {
      console.error('[delete-from-dropbox] DROPBOX_ACCESS_TOKEN not configured')
      throw new Error('DROPBOX_ACCESS_TOKEN not configured')
    }

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
