import { Router } from 'express'
import QRCode from 'qrcode'

import { getCurrentQR } from '../store/qrStore.js'

const router = Router()

router.get('/qr', async (_req, res) => {
    const qr = getCurrentQR()
    if (!qr) {
        return res.status(404).send('QR code not available')
    }

    try {
        const qrDataUrl = await QRCode.toDataURL(qr)
        res.type('html').send(`<html><body><img src="${qrDataUrl}" alt="QR Code" /></body></html>`)
    } catch (err) {
        res.status(500).send('Failed to generate QR code')
    }
})

export default router
