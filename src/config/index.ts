import dotenv from 'dotenv'

dotenv.config()

// Validate required environment variables
const requiredEnvVars = [
    'OPENAI_API_KEY',
    'NOTION_API_KEY',
    'NOTION_DATABASE_ID'
]

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}\nPlease check your .env file and ensure all required variables are set.`)
}


export const config = {
    server: {
        port: process.env.PORT || 3000
    },
    bot: {
        name: process.env.BOT_NAME || 'Ikigai Bot',
        sessionName: process.env.SESSION_NAME || 'ikigai_session',
        aiEnabled: process.env.AI_ENABLED === 'true'
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