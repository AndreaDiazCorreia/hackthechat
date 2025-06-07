import path from 'path'

import express from 'express'
import session from 'express-session'
import { engine } from 'express-handlebars'

import { config } from '../config/index'
import routes from '../routes/index'
import { createLogger } from '../logger/index'

const logger = createLogger('Express')

export function startServer() {
    const app = express()

    app.engine('hbs', engine({ extname: '.hbs' }))
    app.set('view engine', 'hbs')
    app.set('views', path.join(process.cwd(), 'src', 'views'))

    app.use(express.urlencoded({ extended: true }))
    app.use(
        session({
            secret: 'mysecret',
            resave: false,
            saveUninitialized: false
        })
    )

    app.use(routes)

    const port = config.server.port
    app.listen(port, () => {
        logger.info(`HTTP server listening on port ${port}`)
    })
}
