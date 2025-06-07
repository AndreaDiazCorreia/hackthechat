import { Client } from '@notionhq/client'
import { config } from '../config/index.js'
import { logger } from '../logger/index.js'

// Inicializar cliente de Notion
let notionClient: Client | null = null

if (config.notion.apiKey) {
    notionClient = new Client({
        auth: config.notion.apiKey
    })
} else {
    logger.warn('NOTION_API_KEY no encontrada. Las funciones de Notion estarán deshabilitadas.')
}

// Tipos para nuestros datos
export interface NotionNote {
    titulo: string
    contenido: string
    etiquetas: string[] // Cambiado a array para múltiples etiquetas
}

export interface NotionQueryResult {
    id: string
    titulo: string
    contenido: string
    etiquetas: string[]
    fechaCreacion: string
    relevancia?: number // Para búsquedas
    coincidencias?: string[] // Partes que coinciden
}

// Función para obtener todas las etiquetas disponibles en la base de datos
export async function getAvailableTags(): Promise<string[]> {
    if (!notionClient || !config.notion.databaseId) {
        logger.error('Cliente de Notion no configurado correctamente')
        return []
    }

    try {
        const database = await notionClient.databases.retrieve({
            database_id: config.notion.databaseId
        })

        const tagsProperty = database.properties['Tags'] as any
        
        if (tagsProperty?.multi_select?.options) {
            const availableTags = tagsProperty.multi_select.options.map((option: any) => option.name)
            logger.info('Etiquetas disponibles obtenidas:', availableTags)
            return availableTags
        }

        return []
    } catch (error) {
        logger.error('Error al obtener etiquetas disponibles:', error)
        return []
    }
}

// Función para crear una nueva nota en Notion con múltiples etiquetas
export async function createNotionNote(note: NotionNote): Promise<boolean> {
    if (!notionClient || !config.notion.databaseId) {
        logger.error('Cliente de Notion no configurado correctamente')
        return false
    }

    try {
        // Convertir array de etiquetas al formato de Notion
        const tagsForNotion = note.etiquetas.map(etiqueta => ({ name: etiqueta }))

        const response = await notionClient.pages.create({
            parent: {
                database_id: config.notion.databaseId
            },
            properties: {
                'Title': {
                    title: [
                        {
                            text: {
                                content: note.titulo
                            }
                        }
                    ]
                },
                'Content': {
                    rich_text: [
                        {
                            text: {
                                content: note.contenido
                            }
                        }
                    ]
                },
                'Tags': {
                    multi_select: tagsForNotion
                },
                'Created Date': {
                    date: {
                        start: new Date().toISOString()
                    }
                }
            }
        })

        logger.info(`Nota creada exitosamente en Notion: ${response.id}`, {
            titulo: note.titulo,
            etiquetas: note.etiquetas
        })
        return true
    } catch (error) {
        logger.error('Error al crear nota en Notion:', error)
        return false
    }
}

// Función para actualizar etiquetas de una nota existente
export async function updateNoteTags(noteId: string, newTags: string[]): Promise<boolean> {
    if (!notionClient) {
        logger.error('Cliente de Notion no configurado correctamente')
        return false
    }

    try {
        const tagsForNotion = newTags.map(etiqueta => ({ name: etiqueta }))

        await notionClient.pages.update({
            page_id: noteId,
            properties: {
                'Tags': {
                    multi_select: tagsForNotion
                }
            }
        })

        logger.info(`Etiquetas actualizadas para nota ${noteId}:`, newTags)
        return true
    } catch (error) {
        logger.error('Error al actualizar etiquetas:', error)
        return false
    }
}

// Función mejorada para búsqueda inteligente
export async function queryNotionNotes(query?: string, etiqueta?: string): Promise<NotionQueryResult[]> {
    if (!notionClient || !config.notion.databaseId) {
        logger.error('Cliente de Notion no configurado correctamente')
        return []
    }

    try {
        // Construir filtros para la consulta
        const filter: any = {}
        
        if (etiqueta) {
            filter.property = 'Tags'
            filter.multi_select = {
                contains: etiqueta
            }
        }

        const response = await notionClient.databases.query({
            database_id: config.notion.databaseId,
            filter: etiqueta ? filter : undefined,
            sorts: [
                {
                    property: 'Created Date',
                    direction: 'descending'
                }
            ]
        })

        let results: NotionQueryResult[] = response.results.map((page: any) => {
            const titulo = page.properties['Title']?.title?.[0]?.text?.content || 'Sin título'
            const contenido = page.properties['Content']?.rich_text?.[0]?.text?.content || ''
            const etiquetasArray = page.properties['Tags']?.multi_select || []
            const etiquetas = etiquetasArray.map((tag: any) => tag.name)
            const fechaCreacion = page.properties['Created Date']?.date?.start || new Date().toISOString()

            return {
                id: page.id,
                titulo,
                contenido,
                etiquetas,
                fechaCreacion
            }
        })

        // Si hay query de texto, aplicar búsqueda inteligente
        if (query) {
            results = performIntelligentSearch(results, query)
        }

        return results
    } catch (error) {
        logger.error('Error al consultar notas en Notion:', error)
        return []
    }
}

// Función de búsqueda inteligente mejorada con sistema de niveles
function performIntelligentSearch(notes: NotionQueryResult[], query: string): NotionQueryResult[] {
    const queryLower = query.toLowerCase().trim()
    
    // Filtrar palabras muy cortas y palabras vacías
    const stopWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'las', 'del', 'los']
    const queryWords = queryLower.split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.includes(word))
    
    // NIVEL 1: Búsqueda exacta (máxima prioridad)
    const exactMatches = searchExactMatches(notes, queryLower, queryWords)
    
    if (exactMatches.length > 0) {
        logger.info('Found exact matches', {
            query: query,
            exactMatchesCount: exactMatches.length
        })
        return exactMatches
    }
    
    // NIVEL 2: Búsqueda con sinónimos (solo si no hay matches exactos)
    const synonymMatches = searchWithSynonyms(notes, queryWords)
    
    if (synonymMatches.length > 0) {
        logger.info('Found synonym matches', {
            query: query,
            synonymMatchesCount: synonymMatches.length
        })
        return synonymMatches
    }
    
    // NIVEL 3: Búsqueda fuzzy muy permisiva (último recurso)
    const fuzzyMatches = searchFuzzy(notes, queryWords)
    
    logger.info('Search completed', {
        query: query,
        exactMatches: 0,
        synonymMatches: 0,
        fuzzyMatches: fuzzyMatches.length
    })
    
    return fuzzyMatches
}

// Función para búsqueda exacta
function searchExactMatches(notes: NotionQueryResult[], queryLower: string, queryWords: string[]): NotionQueryResult[] {
    const resultsWithRelevance = notes.map(note => {
        let relevancia = 0
        const coincidencias: string[] = []
        
        const tituloLower = note.titulo.toLowerCase()
        const contenidoLower = note.contenido.toLowerCase()
        const etiquetasText = note.etiquetas.join(' ').toLowerCase()
        
        // Búsqueda de la frase completa
        if (tituloLower.includes(queryLower)) {
            relevancia += 30
            coincidencias.push(`Título contiene exactamente: "${queryLower}"`)
        }
        if (contenidoLower.includes(queryLower)) {
            relevancia += 25
            coincidencias.push(`Contenido contiene exactamente: "${queryLower}"`)
        }
        if (etiquetasText.includes(queryLower)) {
            relevancia += 20
            coincidencias.push(`Etiqueta contiene exactamente: "${queryLower}"`)
        }
        
        // Búsqueda de palabras individuales (solo si no encontró la frase completa)
        if (relevancia === 0) {
            queryWords.forEach(word => {
                if (tituloLower.includes(word)) {
                    relevancia += 15
                    coincidencias.push(`Título contiene: "${word}"`)
                }
                if (contenidoLower.includes(word)) {
                    relevancia += 12
                    coincidencias.push(`Contenido contiene: "${word}"`)
                }
                if (etiquetasText.includes(word)) {
                    relevancia += 10
                    coincidencias.push(`Etiqueta contiene: "${word}"`)
                }
            })
        }

        return {
            ...note,
            relevancia,
            coincidencias: coincidencias.length > 0 ? coincidencias : undefined
        }
    })

    return resultsWithRelevance
        .filter(note => note.relevancia! > 0)
        .sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0))
}

// Función para búsqueda con sinónimos (solo si no hay matches exactos)
function searchWithSynonyms(notes: NotionQueryResult[], queryWords: string[]): NotionQueryResult[] {
    // Diccionario de sinónimos más específico
    const synonyms: Record<string, string[]> = {
        'arepas': ['arepa', 'venezuelana', 'harina', 'maiz'],
        'pasta': ['espagueti', 'linguini', 'macarrones', 'italiana'],
        'vino': ['copa', 'botella', 'tinto', 'blanco'],
        'video': ['tutorial', 'youtube'],
        'receta': ['cocinar', 'preparar', 'ingredientes'],
        'evento': ['actividad', 'reunion', 'cita', 'plan'],
        'trabajo': ['oficina', 'laboral', 'proyecto'],
        'viaje': ['turismo', 'destino', 'vacaciones']
    }

    const resultsWithRelevance = notes.map(note => {
        let relevancia = 0
        const coincidencias: string[] = []
        
        const tituloLower = note.titulo.toLowerCase()
        const contenidoLower = note.contenido.toLowerCase()
        const etiquetasText = note.etiquetas.join(' ').toLowerCase()
        
        queryWords.forEach(word => {
            const relatedWords = synonyms[word] || []
            
            relatedWords.forEach(synonym => {
                if (tituloLower.includes(synonym)) {
                    relevancia += 5
                    coincidencias.push(`Título relacionado (${word} → ${synonym})`)
                }
                if (contenidoLower.includes(synonym)) {
                    relevancia += 3
                    coincidencias.push(`Contenido relacionado (${word} → ${synonym})`)
                }
                if (etiquetasText.includes(synonym)) {
                    relevancia += 4
                    coincidencias.push(`Etiqueta relacionada (${word} → ${synonym})`)
                }
            })
        })

        return {
            ...note,
            relevancia,
            coincidencias: coincidencias.length > 0 ? coincidencias : undefined
        }
    })

    return resultsWithRelevance
        .filter(note => note.relevancia! > 0)
        .sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0))
}

// Función para búsqueda fuzzy (último recurso)
function searchFuzzy(notes: NotionQueryResult[], queryWords: string[]): NotionQueryResult[] {
    const resultsWithRelevance = notes.map(note => {
        let relevancia = 0
        const coincidencias: string[] = []
        
        queryWords.forEach(word => {
            if (word.length > 4) {
                // Búsqueda de subcadenas
                if (note.titulo.toLowerCase().includes(word.substring(0, 4)) || 
                    note.contenido.toLowerCase().includes(word.substring(0, 4))) {
                    relevancia += 1
                    coincidencias.push(`Coincidencia parcial con: "${word}"`)
                }
            }
        })

        return {
            ...note,
            relevancia,
            coincidencias: coincidencias.length > 0 ? coincidencias : undefined
        }
    })

    return resultsWithRelevance
        .filter(note => note.relevancia! > 0)
        .sort((a, b) => (b.relevancia || 0) - (a.relevancia || 0))
}

// Función para obtener conteo de notas por etiqueta
export async function getNotesCount(): Promise<{ total: number, porEtiqueta: Record<string, number> }> {
    if (!notionClient || !config.notion.databaseId) {
        return { total: 0, porEtiqueta: {} }
    }

    try {
        const response = await notionClient.databases.query({
            database_id: config.notion.databaseId
        })

        const porEtiqueta: Record<string, number> = {}
        
        response.results.forEach((page: any) => {
            const etiquetas = page.properties['Tags']?.multi_select || []
            etiquetas.forEach((tag: any) => {
                const etiqueta = tag.name || 'sin-etiqueta'
                porEtiqueta[etiqueta] = (porEtiqueta[etiqueta] || 0) + 1
            })
        })

        return {
            total: response.results.length,
            porEtiqueta
        }
    } catch (error) {
        logger.error('Error al obtener conteo de notas:', error)
        return { total: 0, porEtiqueta: {} }
    }
}

// Función para buscar notas similares (para sugerir etiquetas)
export async function findSimilarNotes(content: string): Promise<NotionQueryResult[]> {
    // Extraer palabras clave del contenido
    const words = content.toLowerCase().split(/\s+/).filter(word => word.length > 3)
    const keyWords = words.slice(0, 3) // Tomar las primeras 3 palabras significativas
    
    if (keyWords.length === 0) return []
    
    // Buscar notas que contengan palabras similares
    const searchQuery = keyWords.join(' ')
    return await queryNotionNotes(searchQuery)
}