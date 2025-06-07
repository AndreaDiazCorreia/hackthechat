import dotenv from 'dotenv'

dotenv.config()

export const config = {
    server: {
        port: process.env.PORT || 3000
    },
    bot: {
        name: process.env.BOT_NAME || 'Ikigai Bot',
        sessionName: process.env.SESSION_NAME || 'ikigai_session',
        aiEnabled: process.env.AI_ENABLED === 'true'
    },
    session: {
        sessionPath: process.env.SESSION_NAME || 'ikigai_session'
    },
    baileys: {
        browser: ['Ikigai Bot', 'Desktop', '1.0.0'],
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 10000,
        qrTimeout: 60000
    },
    ai: {
        apiKey: process.env.OPENAI_API_KEY,
        systemPrompt: process.env.AI_SYSTEM_PROMPT || 'Eres Ikigai, un asistente inteligente para gestión de notas.'
    },
    notion: {
        apiKey: process.env.NOTION_API_KEY,
        databaseId: process.env.NOTION_DATABASE_ID
    },
    logger: {
        level: process.env.LOG_LEVEL || 'info'
    }
}