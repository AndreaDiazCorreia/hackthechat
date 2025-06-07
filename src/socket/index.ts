import { AuthenticationState, WASocket, makeWASocket, useMultiFileAuthState } from 'baileys'

import { config } from '../config/index.js'
import { createLogger } from '../logger/index.js'

export interface ConnectionResult {
    sock: WASocket
    authState: AuthenticationState
    saveCreds: () => Promise<void>
}

export async function createAuthenticatedSocket(): Promise<ConnectionResult> {
    const { state, saveCreds } = await useMultiFileAuthState(config.session.sessionPath)

    // Create Baileys internal logger
    const baileysLogger = createLogger('Baileys', { level: 'warn' })

    // Create WhatsApp socket (you can customize this as you want :D)
    const sock = makeWASocket({
        auth: state,
        browser: config.baileys.browser,
        generateHighQualityLinkPreview: config.baileys.generateHighQualityLinkPreview,
        syncFullHistory: config.baileys.syncFullHistory,
        markOnlineOnConnect: config.baileys.markOnlineOnConnect,
        keepAliveIntervalMs: config.baileys.keepAliveIntervalMs,
        qrTimeout: config.baileys.qrTimeout,
        logger: baileysLogger.getPinoInstance()
    })

    return { sock, authState: state, saveCreds }
}
