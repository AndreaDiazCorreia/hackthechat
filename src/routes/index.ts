import { Router } from 'express'

import authRouter from './auth.js'
import dashboardRouter from './dashboard.js'
import qrRouter from './qr.js'

const router = Router()

router.use(authRouter)
router.use(dashboardRouter)
router.use(qrRouter)

export default router
