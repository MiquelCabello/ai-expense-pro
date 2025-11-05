// Test manual para verificar la integración con Dropbox
// Este archivo se puede ejecutar desde la consola del navegador

import { supabase } from '@/integrations/supabase/client'

export async function testDropboxUpload() {
  console.log('🧪 Iniciando test de integración con Dropbox...')
  
  try {
    // 1. Obtener un gasto reciente que tenga receipt_file_id
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('id, receipt_file_id, vendor, employee_id')
      .not('receipt_file_id', 'is', null)
      .limit(1)
      .single()

    if (expensesError) {
      console.error('Error obteniendo gastos:', expensesError)
      return
    }

    console.log('✅ Gasto encontrado:', expenses)

    // 2. Obtener info del archivo
    const { data: fileData, error: fileError } = await supabase
      .from('receipt_files')
      .select('path, original_name, user_id')
      .eq('id', expenses.receipt_file_id)
      .single()

    if (fileError) {
      console.error('Error obteniendo archivo:', fileError)
      return
    }

    console.log('✅ Archivo encontrado:', fileData)

    // 3. Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileData.path)

    console.log('✅ URL pública:', urlData.publicUrl)

    // 4. Obtener company_id del usuario
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select('company_id, department_id')
      .eq('user_id', expenses.employee_id)
      .single()

    if (membershipError) {
      console.error('Error obteniendo membership:', membershipError)
      return
    }

    console.log('✅ Membership encontrada:', membership)

    // 5. Llamar a la edge function
    console.log('📤 Llamando a upload-to-dropbox...')
    const { data, error } = await supabase.functions.invoke('upload-to-dropbox', {
      body: {
        file_url: urlData.publicUrl,
        file_name: fileData.original_name,
        company_id: membership.company_id,
        user_id: expenses.employee_id,
        department_id: membership.department_id,
      }
    })

    if (error) {
      console.error('❌ Error en edge function:', error)
      return
    }

    console.log('✅ Respuesta de Dropbox:', data)

    // 6. Actualizar el gasto con la info de Dropbox
    if (data.dropbox_path) {
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          dropbox_path: data.dropbox_path,
          dropbox_url: data.dropbox_url,
        })
        .eq('id', expenses.id)

      if (updateError) {
        console.error('❌ Error actualizando gasto:', updateError)
      } else {
        console.log('✅ Gasto actualizado con éxito!')
      }
    }

    console.log('🎉 Test completado con éxito!')
    return data

  } catch (error) {
    console.error('❌ Error en el test:', error)
  }
}

// Exportar para uso en consola
if (typeof window !== 'undefined') {
  (window as any).testDropboxUpload = testDropboxUpload
  console.log('💡 Ejecuta testDropboxUpload() en la consola para probar la integración')
}
