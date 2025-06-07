import { BaileysEventMap, WASocket, WAMessage } from 'baileys'
import { config } from '../config/index.js'
import { classifyIntent, formatQueryResponse } from '../services/intentClassifier.js'
import { createNotionNote, queryNotionNotes, getNotesCount } from '../services/notion.js'
import { createLogger } from '../logger/index.js'

const logger = createLogger('MessageHandler')

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
                text: `📎 Recibí un ${mediaType}. Si quieres que lo guarde como nota, envíamelo de nuevo con una descripción.` 
            })
            return
        }

        logger.info('Message received', {
            from: remoteJid,
            text: textContent,
            messageId: message.key.id
        })

        // Usar el nuevo sistema inteligente si AI está habilitado
        if (config.bot.aiEnabled) {
            await handleIntelligentMessage(sock, remoteJid, textContent)
        } else {
            // Fallback al modo echo si AI está deshabilitado
            await sock.sendMessage(remoteJid, {
                text: `Echo: ${textContent}`
            })
            logger.info('Echo response sent', {
                to: remoteJid,
                originalText: textContent
            })
        }

    } catch (error) {
        logger.error('Error handling message', error, {
            messageId: message.key.id,
            from: message.key.remoteJid
        })
    }
}

async function handleIntelligentMessage(sock: WASocket, remoteJid: string, textContent: string) {
    try {
        logger.info('Processing intelligent message', { from: remoteJid, content: textContent })

        // Clasificar la intención del mensaje
        const intent = await classifyIntent(textContent)
        
        let response = ''

        switch (intent.type) {
            case 'save_note':
                // Guardar la nota automáticamente
                const noteData = {
                    titulo: intent.titulo,
                    contenido: intent.contenido,
                    etiqueta: intent.etiqueta
                }

                logger.info('Saving note', noteData)
                const success = await createNotionNote(noteData)
                
                if (success) {
                    response = `✅ Nota guardada: "${intent.titulo}" en ${intent.etiqueta}`
                } else {
                    response = '❌ Hubo un problema guardando la nota. ¿Puedes intentar de nuevo?'
                }
                break

            case 'query':
                // Procesar consulta
                logger.info('Processing query', { queryType: intent.queryType, parameter: intent.parameter })
                let notes: any[] = []
                
                switch (intent.queryType) {
                    case 'by_tag':
                        if (intent.parameter) {
                            notes = await queryNotionNotes(undefined, intent.parameter)
                        }
                        break
                    
                    case 'by_keyword':
                        if (intent.parameter) {
                            notes = await queryNotionNotes(intent.parameter)
                        }
                        break
                    
                    case 'recent':
                        notes = await queryNotionNotes()
                        notes = notes.slice(0, 10) // Las 10 más recientes
                        break
                    
                    case 'count':
                        const stats = await getNotesCount()
                        response = `📊 Tienes **${stats.total}** notas en total:\n\n`
                        
                        Object.entries(stats.porEtiqueta).forEach(([etiqueta, cantidad]) => {
                            response += `🏷️ ${etiqueta}: ${cantidad}\n`
                        })
                        
                        response += `\n¿Quieres ver alguna categoría específica?`
                        break
                }

                if (intent.queryType !== 'count') {
                    response = formatQueryResponse(notes, intent.queryType, intent.parameter)
                }
                break

            case 'conversation':
                // Respuesta conversacional
                response = intent.response
                break

            case 'unclear':
                // Pedir clarificación
                response = intent.clarificationQuestion
                break

            default:
                response = 'No estoy seguro de cómo ayudarte con eso. ¿Puedes ser más específico?'
        }

        // Enviar respuesta
        await sock.sendMessage(remoteJid, { text: response })
        
        logger.info('Response sent successfully', { 
            type: intent.type, 
            responseLength: response.length 
        })

    } catch (error) {
        logger.error('Error in intelligent message handling:', error)
        
        // Respuesta de fallback en caso de error
        const fallbackResponse = 'Disculpa, tuve un problema procesando tu mensaje. ¿Puedes intentar de nuevo?'
        
        try {
            await sock.sendMessage(remoteJid, { text: fallbackResponse })
        } catch (sendError) {
            logger.error('Error sending fallback response:', sendError)
        }
    }
}