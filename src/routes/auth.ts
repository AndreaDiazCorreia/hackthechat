import { Router } from 'express'

const router = Router()

router.get('/login', (req, res) => {
    res.render('login')
})

router.post('/login', (req, res) => {
    const { username, password } = req.body as Record<string, string>
    if (username === 'test' && password === 'test') {
        req.session!.authenticated = true
        return res.redirect('/dashboard')
    }
    res.render('login', { error: 'Invalid credentials' })
})

router.get('/logout', (req, res) => {
    req.session?.destroy(() => {
        res.redirect('/login')
    })
})

export default router
