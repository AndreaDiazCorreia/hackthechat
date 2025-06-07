import { Browsers } from 'baileys'

export const config = {
    // Session
    session: {
        sessionPath: process.env.SESSION_NAME || 'auth_info_baileys'
    },

    // Baileys
    baileys: {
        browser: Browsers.macOS('Chrome'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 60000,
        qrTimeout: 40000
    },

    // Server
    server: {
        port: parseInt(process.env.PORT || '8081')
    },

    // Bot
    bot: {
        name: process.env.BOT_NAME || 'HackTheChat',
        aiEnabled: process.env.AI_ENABLED === 'true'
    },

    // OpenAI
    ai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        systemPrompt: process.env.AI_SYSTEM_PROMPT || ''
    },

    // Logging
    logs: {
        level: process.env.LOG_LEVEL || 'info',
        colorize: true,
        timestamp: true
    }
}

export type Config = typeof config
