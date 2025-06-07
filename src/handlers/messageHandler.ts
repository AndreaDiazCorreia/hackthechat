import { BaileysEventMap, WASocket, WAMessage } from 'baileys'
import { config } from '../config/index.js'
import { classifyIntent, formatQueryResponse, parseTagCorrection } from '../services/intentClassifier.js'
import { createNotionNote, queryNotionNotes, getNotesCount, updateNoteTags } from '../services/notion.js'
import { createLogger } from '../logger/index.js'

const logger = createLogger('MessageHandler')

// Store para mantener contexto de conversaciones (en memoria)
const conversationContext = new Map<string, {
    lastNote?: any,
    awaitingTagCorrection?: boolean,
    lastQuery?: string
}>()

export function setupMessageHandler(sock: WASocket) {
    // Handle incoming messages
    sock.ev.on(
        'messages.upsert',
        async ({ messages, type }: BaileysEventMap['messages.upsert']) => {
            // Only process new messages
            if (type !== 'notify') return

            for (const message of messages) {
                // Skip if no message content
                if (!message.message) continue

                // Skip messages from self
                if (message.key.fromMe) continue

                await handleMessage(sock, message)
            }
        }
    )
}

async function handleMessage(sock: WASocket, message: WAMessage) {
    try {
        const remoteJid = message.key.remoteJid
        if (!remoteJid) return

        // Filtrar mensajes de grupos - solo procesar mensajes directos
        if (remoteJid.endsWith('@g.us')) {
            logger.info('Ignoring group message', { groupId: remoteJid })
            return
        }

        // Get the text content from the message
        const textContent =
            message.message?.conversation || 
            message.message?.extendedTextMessage?.text || 
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            message.message?.documentMessage?.caption ||
            ''

        if (!textContent) {
            // Si es un archivo sin caption, sugerir que agregue descripción
            const mediaType = message.message?.imageMessage ? 'imagen' :
                             message.message?.videoMessage ? 'video' :
                             message.message?.documentMessage ? 'documento' :
                             'archivo'
            
            await sock.sendMessage(remoteJid, { 
                text: `📎 Recibí un ${mediaType}. Para poder guardarlo como nota, ¿puedes enviarlo con una descripción o caption? Por ejemplo: "Esta es mi receta favorita" junto con la imagen.`
            })
            return
        }

        logger.info('Processing message', { 
            from: remoteJid, 
            content: textContent.substring(0, 100) + '...' 
        })

        // Obtener o crear contexto de conversación
        const context = conversationContext.get(remoteJid) || {}

        // Procesar con IA solo si está habilitada
        if (config.bot.aiEnabled && config.ai.apiKey) {
            await handleIntelligentMessage(sock, remoteJid, textContent, context)
        } else {
            // Respuesta básica sin IA
            await sock.sendMessage(remoteJid, { 
                text: 'Hola! Soy Ikigai. La funcionalidad de IA no está habilitada. Por favor, configura OPENAI_API_KEY y AI_ENABLED=true.' 
            })
        }

    } catch (error) {
        logger.error('Error handling message:', error)
        
        // Respuesta de emergencia
        if (message.key.remoteJid) {
            await sock.sendMessage(message.key.remoteJid, { 
                text: 'Disculpa, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?' 
            })
        }
    }
}

async function handleIntelligentMessage(sock: WASocket, remoteJid: string, textContent: string, context: any) {
    try {
        // Verificar si es una corrección de etiquetas en base al contexto
        if (context.awaitingTagCorrection && context.lastNote) {
            const tagCorrection = parseTagCorrection(textContent, context.lastNote.titulo)
            if (tagCorrection) {
                const success = await updateNoteTags(context.lastNote.id, tagCorrection.newTags)
                
                if (success) {
                    const response = `✅ ¡Perfecto! Actualicé las etiquetas de "${context.lastNote.titulo}" a: ${tagCorrection.newTags.join(', ')}`
                    await sock.sendMessage(remoteJid, { text: response })
                    
                    // Limpiar contexto
                    context.awaitingTagCorrection = false
                    context.lastNote = undefined
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: 'Hubo un problema al actualizar las etiquetas. ¿Puedes intentar de nuevo?' 
                    })
                }
                
                conversationContext.set(remoteJid, context)
                return
            }
        }

        // Clasificar la intención del mensaje
        const intent = await classifyIntent(textContent)
        
        let response = ''

        switch (intent.type) {
            case 'save_note': {
                // Guardar nota con múltiples etiquetas
                logger.info('Saving note', { 
                    titulo: intent.titulo, 
                    etiquetas: intent.etiquetas 
                })
                
                const pageId = await createNotionNote({
                    titulo: intent.titulo,
                    contenido: intent.contenido,
                    etiquetas: intent.etiquetas
                })

                if (pageId) {
                    response = `✅ ¡Perfecto! Guardé tu nota "${intent.titulo}"`
                    
                    if (intent.etiquetas.length > 1) {
                        response += ` con las etiquetas: ${intent.etiquetas.join(', ')}`
                    } else {
                        response += ` en la categoría "${intent.etiquetas[0]}"`
                    }
                    
                    // Agregar sugerencias si las hay
                    if (intent.suggested_tags && intent.suggested_tags.length > 0) {
                        const uniqueSuggested = intent.suggested_tags.filter(tag => !intent.etiquetas.includes(tag))
                        if (uniqueSuggested.length > 0) {
                            response += `\n\n💡 También podrías etiquetarla como: ${uniqueSuggested.join(', ')}`
                            response += `\n¿Quieres agregar alguna de estas etiquetas?`
                            
                            // Guardar contexto para posible corrección
                            context.awaitingTagCorrection = true
                            context.lastNote = {
                                id: pageId, // Usar el ID real de la página creada
                                titulo: intent.titulo,
                                etiquetas: intent.etiquetas
                            }
                        }
                    } else {
                        response += `\n\n¿Las etiquetas están bien o quieres cambiar algo?`
                        context.awaitingTagCorrection = true
                        context.lastNote = {
                            id: pageId, // Usar el ID real de la página creada
                            titulo: intent.titulo,
                            etiquetas: intent.etiquetas
                        }
                    }
                } else {
                    response = 'Lo siento, hubo un problema guardando tu nota. ¿Puedes intentar de nuevo?'
                }
                break
            }

            case 'query': {
                // Procesar consulta con búsqueda inteligente
                logger.info('Processing intelligent query', { 
                    queryType: intent.queryType, 
                    parameter: intent.parameter 
                })
                let notes: any[] = []
                
                switch (intent.queryType) {
                    case 'by_tag': {
                        if (intent.parameter) {
                            notes = await queryNotionNotes(undefined, intent.parameter)
                        }
                        break
                    }
                    
                    case 'by_keyword': {
                        if (intent.parameter) {
                            notes = await queryNotionNotes(intent.parameter)
                            
                            // Guardar la búsqueda en el contexto
                            context.lastQuery = intent.parameter
                        }
                        break
                    }
                    
                    case 'recent': {
                        notes = await queryNotionNotes()
                        notes = notes.slice(0, 10) // Las 10 más recientes
                        break
                    }
                    
                    case 'count': {
                        const stats = await getNotesCount()
                        response = `📊 Tienes **${stats.total}** notas en total:\n\n`
                        
                        Object.entries(stats.porEtiqueta).forEach(([etiqueta, cantidad]) => {
                            response += `🏷️ ${etiqueta}: ${cantidad}\n`
                        })
                        
                        response += `\n¿Quieres ver alguna categoría específica?`
                        break
                    }
                }

                if (intent.queryType !== 'count') {
                    response = formatQueryResponse(notes, intent.queryType, intent.parameter)
                    
                    // Agregar opciones adicionales si hay resultados
                    if (notes.length > 0 && intent.queryType === 'by_keyword') {
                        response += `\n\n¿Quieres refinar la búsqueda o ver detalles de alguna nota específica?`
                    }
                }
                break
            }

            case 'conversation': {
                // Respuesta conversacional
                response = intent.response
                
                // Limpiar contexto en conversaciones casuales
                if (textContent.toLowerCase().includes('hola') || textContent.toLowerCase().includes('gracias')) {
                    context.awaitingTagCorrection = false
                    context.lastNote = undefined
                    context.lastQuery = undefined
                }
                break
            }

            case 'unclear': {
                // Pedir clarificación
                response = intent.clarificationQuestion
                break
            }

            case 'tag_correction': {
                // Manejar corrección de etiquetas
                if (context.lastNote && context.lastNote.id) {
                    // Usar directamente el ID almacenado en el contexto
                    const success = await updateNoteTags(context.lastNote.id, intent.newTags)
                    
                    if (success) {
                        response = `✅ ¡Listo! Cambié las etiquetas de "${context.lastNote.titulo}" a: ${intent.newTags.join(', ')}`
                        context.awaitingTagCorrection = false
                        context.lastNote = undefined
                    } else {
                        response = 'Hubo un problema al actualizar las etiquetas. ¿Puedes intentar de nuevo?'
                    }
                } else {
                    response = 'No tengo contexto de qué nota quieres modificar. ¿Puedes especificar cuál?'
                }
                break;
            }

            default: {
                response = 'No estoy seguro de cómo ayudarte con eso. ¿Puedes ser más específico?'
            }
        }

        // Actualizar contexto
        conversationContext.set(remoteJid, context)

        // Enviar respuesta
        await sock.sendMessage(remoteJid, { text: response })
        
        logger.info('Response sent successfully', { 
            type: intent.type, 
            responseLength: response.length,
            hasContext: Object.keys(context).length > 0
        })

    } catch (error) {
        logger.error('Error in intelligent message handling:', error)
        
        // Respuesta de fallback en caso de error
        const fallbackResponse = 'Disculpa, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?'
        await sock.sendMessage(remoteJid, { text: fallbackResponse })
    }
}