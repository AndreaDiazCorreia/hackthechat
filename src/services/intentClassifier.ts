import { generateResponse } from '../ai/openai.js'
import { logger } from '../logger/index.js'

// Tipos para las respuestas del clasificador
export interface SaveNoteIntent {
    type: 'save_note'
    titulo: string
    contenido: string
    etiqueta: string
    confidence: number
}

export interface QueryIntent {
    type: 'query'
    queryType: 'by_tag' | 'by_keyword' | 'count' | 'recent'
    parameter?: string
    confidence: number
}

export interface ConversationIntent {
    type: 'conversation'
    response: string
    confidence: number
}

export interface UnclearIntent {
    type: 'unclear'
    clarificationQuestion: string
}

export type IntentResult = SaveNoteIntent | QueryIntent | ConversationIntent | UnclearIntent

// Prompt del sistema para clasificación de intenciones
const CLASSIFICATION_PROMPT = `
Eres Ikigai, un asistente inteligente para gestión de notas via WhatsApp. Tu tarea es analizar cada mensaje y clasificar la intención del usuario.

TIPOS DE INTENCIÓN:

1. **GUARDAR NOTA** - El usuario quiere guardar información
   - Recetas (ingredientes, pasos, cocina)
   - Links útiles (URLs, artículos, recursos)
   - Ideas (pensamientos, conceptos, inspiración)
   - Eventos (fechas, reuniones, actividades)
   - Otros (cualquier información que quiera recordar)

2. **CONSULTAR** - El usuario quiere buscar información guardada
   - "¿Qué recetas tengo?"
   - "Muéstrame mis notas de esta semana"
   - "Busca algo sobre proyectos"
   - "¿Cuántas notas tengo?"

3. **CONVERSACIÓN** - Saludos, agradecimientos, charla casual
   - "Hola", "Gracias", "¿Cómo estás?"

4. **NO CLARO** - Mensaje ambiguo que necesita clarificación

ETIQUETAS DISPONIBLES: "Links útiles", "Recetas", "Ideas", "Evento", "Otros"

INSTRUCCIONES:
- Responde SOLO con un JSON válido
- Para notas: extrae título descriptivo, contenido estructurado, y etiqueta apropiada
- Para consultas: identifica qué tipo de búsqueda quiere hacer
- Para conversación: genera respuesta natural y amigable
- Para mensajes ambiguos: formula pregunta clarificadora

EJEMPLOS DE RESPUESTA:

Para nota clara:
{
  "type": "save_note",
  "titulo": "Pasta con tomate",
  "contenido": "Hervir pasta, saltear ajo, agregar tomate, mezclar",
  "etiqueta": "Recetas",
  "confidence": 0.9
}

Para consulta:
{
  "type": "query", 
  "queryType": "by_tag",
  "parameter": "Recetas",
  "confidence": 0.85
}

Para conversación:
{
  "type": "conversation",
  "response": "¡Hola! Soy Ikigai, tu asistente para organizar notas. ¿En qué puedo ayudarte hoy?",
  "confidence": 0.95
}

Para mensaje ambiguo:
{
  "type": "unclear",
  "clarificationQuestion": "¿Quieres que guarde esto como una tarea, una nota general, o algo más específico?"
}

Analiza este mensaje del usuario:`

export async function classifyIntent(userMessage: string): Promise<IntentResult> {
    try {
        const fullPrompt = `${CLASSIFICATION_PROMPT}\n\nMensaje: "${userMessage}"`
        
        const response = await generateResponse(fullPrompt)
        
        // Intentar parsear la respuesta JSON
        let result: IntentResult
        try {
            result = JSON.parse(response)
        } catch (parseError) {
            logger.warn('Error parsing classification response, falling back to conversation', { response })
            return {
                type: 'conversation',
                response: 'Disculpa, no entendí bien tu mensaje. ¿Podrías reformularlo?',
                confidence: 0.3
            }
        }

        logger.info('Intent classified successfully', { 
            type: result.type, 
            confidence: 'confidence' in result ? result.confidence : 'N/A'
        })
        
        return result

    } catch (error) {
        logger.error('Error classifying intent:', error)
        return {
            type: 'conversation',
            response: 'Disculpa, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?',
            confidence: 0.1
        }
    }
}

// Función auxiliar para validar si una clasificación es confiable
export function isHighConfidence(intent: IntentResult): boolean {
    if ('confidence' in intent) {
        return intent.confidence > 0.7
    }
    return false
}

// Función para formatear respuestas de consulta
export function formatQueryResponse(notes: any[], queryType: string, parameter?: string): string {
    if (notes.length === 0) {
        if (parameter) {
            return `No encontré notas sobre "${parameter}". ¿Quieres que guarde algo al respecto?`
        }
        return 'No tienes notas guardadas aún. ¡Envíame algo para empezar!'
    }

    let response = ''
    
    switch (queryType) {
        case 'by_tag':
            response = `📝 Tienes ${notes.length} nota${notes.length > 1 ? 's' : ''} en "${parameter}":\n\n`
            break
        case 'by_keyword':
            response = `🔍 Encontré ${notes.length} nota${notes.length > 1 ? 's' : ''} sobre "${parameter}":\n\n`
            break
        case 'recent':
            response = `📅 Tus notas más recientes:\n\n`
            break
        case 'count':
            response = `📊 Tienes un total de ${notes.length} notas:\n\n`
            break
        default:
            response = `📋 Encontré ${notes.length} nota${notes.length > 1 ? 's' : ''}:\n\n`
    }

    // Mostrar hasta 5 notas para no saturar WhatsApp
    const limitedNotes = notes.slice(0, 5)
    
    limitedNotes.forEach((note, index) => {
        const shortContent = note.contenido.length > 100 
            ? note.contenido.substring(0, 100) + '...'
            : note.contenido
        
        response += `${index + 1}. **${note.titulo}**\n`
        response += `   ${shortContent}\n`
        response += `   🏷️ ${note.etiqueta}\n\n`
    })

    if (notes.length > 5) {
        response += `... y ${notes.length - 5} nota${notes.length - 5 > 1 ? 's' : ''} más.`
    }

    return response
}