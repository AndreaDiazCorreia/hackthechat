import OpenAI from 'openai'
import { config } from '../config/index.js'

let client: OpenAI | null = null

if (config.ai.apiKey) {
    client = new OpenAI({ apiKey: config.ai.apiKey })
}

export async function generateResponse(prompt: string): Promise<string> {
    if (!client) {
        throw new Error('OpenAI API key is missing. Set OPENAI_API_KEY to enable AI responses.')
    }

    const messages: { role: 'system' | 'user'; content: string }[] = []
    if (config.ai.systemPrompt) {
        messages.push({ role: 'system', content: config.ai.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const chat = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages
    })

    return chat.choices[0]?.message?.content?.trim() || ''
}
