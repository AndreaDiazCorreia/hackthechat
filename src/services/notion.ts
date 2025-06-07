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
    etiqueta: string
}

export interface NotionQueryResult {
    id: string
    titulo: string
    contenido: string
    etiqueta: string
    fechaCreacion: string
}

// Función para crear una nueva nota en Notion
export async function createNotionNote(note: NotionNote): Promise<boolean> {
    if (!notionClient || !config.notion.databaseId) {
        logger.error('Cliente de Notion no configurado correctamente')
        return false
    }

    try {
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
                    multi_select: [
                        {
                            name: note.etiqueta
                        }
                    ]
                }
            }
        })

        logger.info(`Nota creada exitosamente en Notion: ${response.id}`)
        return true
    } catch (error) {
        logger.error('Error al crear nota en Notion:', error)
        return false
    }
}

// Función para consultar notas en Notion
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

        const results: NotionQueryResult[] = response.results.map((page: any) => {
            const titulo = page.properties['Title']?.title?.[0]?.text?.content || 'Sin título'
            const contenido = page.properties['Content']?.rich_text?.[0]?.text?.content || ''
            // Para multi_select, tomamos la primera etiqueta o concatenamos todas
            const etiquetas = page.properties['Tags']?.multi_select || []
            const etiqueta = etiquetas.length > 0 ? etiquetas.map((tag: any) => tag.name).join(', ') : 'sin-etiqueta'
            const fechaCreacion = page.created_time

            return {
                id: page.id,
                titulo,
                contenido,
                etiqueta,
                fechaCreacion
            }
        })

        // Si hay query de texto, filtrar por contenido
        if (query) {
            const filteredResults = results.filter(note => 
                note.titulo.toLowerCase().includes(query.toLowerCase()) ||
                note.contenido.toLowerCase().includes(query.toLowerCase())
            )
            return filteredResults
        }

        return results
    } catch (error) {
        logger.error('Error al consultar notas en Notion:', error)
        return []
    }
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