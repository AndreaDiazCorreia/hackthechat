// test-notion.ts - Archivo temporal para probar la conexión
import { createNotionNote, queryNotionNotes, getNotesCount } from './src/services/notion.js'

async function testNotion() {
    console.log('🧪 Probando conexión con Notion...')

    try {
        // Probar crear una nota
        const testNote = {
            titulo: 'Nota de prueba',
            contenido: 'Esta es una nota de prueba para verificar la conexión con Notion.',
            etiquetas: ['prueba']
        }

        console.log('📝 Creando nota de prueba...')
        const success = await createNotionNote(testNote)
        
        if (success) {
            console.log('✅ Nota creada exitosamente!')
        } else {
            console.log('❌ Error al crear la nota')
            return
        }

        // Probar consultar notas
        console.log('🔍 Consultando notas...')
        const notes = await queryNotionNotes()
        console.log(`📊 Encontradas ${notes.length} notas:`)
        
        notes.forEach(note => {
            console.log(`  - ${note.titulo} [${note.etiquetas.join(', ')}]`)
        })

        // Probar conteo
        console.log('📈 Obteniendo estadísticas...')
        const stats = await getNotesCount()
        console.log(`📊 Total de notas: ${stats.total}`)
        console.log('📋 Por etiqueta:', stats.porEtiqueta)

    } catch (error) {
        console.error('❌ Error durante las pruebas:', error)
    }
}

testNotion()