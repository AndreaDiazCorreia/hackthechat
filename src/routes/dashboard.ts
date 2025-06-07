import { Router } from 'express'
import { getInfo } from '../store/connectionStore.js'
import { disconnectSocket } from '../socket/manager.js'

const router = Router()

router.get('/dashboard', (req, res) => {
    if (!req.session?.authenticated) {
        return res.redirect('/login')
    }
    const info = getInfo()
    res.render('dashboard', {
        info,
        timeSinceConnected: info.connectedAt
            ? Math.floor((Date.now() - info.connectedAt.getTime()) / 1000)
            : null
    })
})

router.post('/dashboard/disconnect', async (_req, res) => {
    await disconnectSocket()
    res.redirect('/dashboard')
})

export default router
