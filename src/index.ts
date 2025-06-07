import 'dotenv/config'

import { Boom } from '@hapi/boom'
import { DisconnectReason, BaileysEventMap, fetchLatestBaileysVersion } from 'baileys'
import qrcode from 'qrcode-terminal'

import { config } from './config/index.js'
import { createAuthenticatedSocket } from './socket/index.js'
import { setSocket } from './socket/manager.js'
import { setupMessageHandler } from './handlers/messageHandler.js'
import { startServer } from './server/index.js'
import { setStatus } from './store/connectionStore.js'
import { setCurrentQR } from './store/qrStore.js'
import { createLogger } from './logger/index.js'

const logger = createLogger('HackTheChat')

async function connectToWhatsApp() {
    const { version, isLatest } = await fetchLatestBaileysVersion()
    logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

    const { sock, saveCreds } = await createAuthenticatedSocket()
    setSocket(sock)
    setupMessageHandler(sock)

    sock.ev.process(async (events: Partial<BaileysEventMap>) => {
        if (events['connection.update']) {
            const { connection, lastDisconnect, qr } = events['connection.update']

            if (qr) {
                setCurrentQR(qr)
                console.log('\n🔗 Scan this QR code with WhatsApp to login:\n')
                qrcode.generate(qr, { small: true })
                console.log('\nWaiting for scan...\n')
                logger.info('QR Code displayed. Scan with WhatsApp to login.')
            } else {
                setCurrentQR(null)
            }

            if (connection === 'close') {
                setStatus('close')
                setSocket(null)
                const shouldReconnect =
                    (lastDisconnect?.error as Boom)?.output?.statusCode !==
                    DisconnectReason.loggedOut

                // Handle stream errors
                // FYI when you connect to WPP for first time, it will throw a stream error (WPP disconnects), so we need to handle it.
                // This is a known issue, and we need to handle it. Don't worry about it.
                if (lastDisconnect?.error?.message?.includes('Stream Errored')) {
                    logger.info('Stream error detected, reconnecting...')
                } else {
                    logger.error('Connection closed due to error', lastDisconnect?.error, {
                        shouldReconnect,
                        errorCode: (lastDisconnect?.error as Boom)?.output?.statusCode
                    })
                }

                if (shouldReconnect) {
                    setTimeout(() => {
                        logger.info('Attempting to reconnect...', { retryCount: 1 })
                        connectToWhatsApp()
                    }, 3000)
                }
            } else if (connection === 'open') {
                setCurrentQR(null)
                setStatus('open', sock.user?.id || null)
                logger.info('✅ Connected to WhatsApp successfully!')
                logger.info('📱 Device registered', { deviceName: config.bot.name })
            } else if (connection === 'connecting') {
                setStatus('connecting')
                logger.info('🔄 Connecting to WhatsApp...')
            }
        }

        // Save credentials when updated
        if (events['creds.update']) {
            await saveCreds()
            logger.debug('Credentials updated and saved')
        }
    })
}

startServer()
connectToWhatsApp().catch(err => {
    logger.fatal('Failed to start bot', err)
})
