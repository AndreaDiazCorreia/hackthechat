import path from 'path'

import pino, { Logger as PinoLogger } from 'pino'

import { config } from '../config/index'

export interface LoggerConfig {
    level?: pino.LevelWithSilent
    prettyPrint?: boolean
    logToFile?: boolean
    filename?: string
}

export interface LoggerMetadata {
    [key: string]: any
}

class Logger {
    private static instances: Map<string, Logger> = new Map()
    private logger: PinoLogger
    private context: string

    private constructor(context: string, options: LoggerConfig = {}) {
        this.context = context
        this.logger = this.createLogger(options)
    }

    /**
     * Get or create a logger instance for a specific context
     */
    static getInstance(context: string, options?: LoggerConfig): Logger {
        if (!Logger.instances.has(context)) {
            Logger.instances.set(context, new Logger(context, options))
        }
        return Logger.instances.get(context)!
    }

    private createLogger(options: LoggerConfig): PinoLogger {
        const level = options.level || (config.logs.level as pino.LevelWithSilent) || 'info'

        const baseConfig: pino.LoggerOptions = {
            name: this.context,
            level,
            timestamp: pino.stdTimeFunctions.isoTime,
            formatters: {
                level: (label: string) => ({ level: label.toUpperCase() }),
                log: (obj: Record<string, unknown>) => {
                    const { pid, hostname, ...cleanObj } = obj
                    return cleanObj
                }
            },
            base: {
                context: this.context,
                env: process.env.NODE_ENV || 'development'
            }
        }

        if (options.logToFile) {
            return pino({
                ...baseConfig,
                transport: {
                    target: 'pino/file',
                    options: {
                        destination:
                            options.filename ||
                            path.join(process.cwd(), 'logs', `${this.context.toLowerCase()}.log`),
                        mkdir: true,
                        sync: false
                    }
                }
            })
        }

        if (process.env.NODE_ENV !== 'production' && options.prettyPrint !== false) {
            return pino({
                ...baseConfig,
                transport: {
                    target: 'pino-pretty',
                    options: {
                        colorize: config.logs.colorize,
                        translateTime: 'yyyy-mm-dd HH:MM:ss',
                        ignore: 'pid,hostname,context,env',
                        messageFormat: '{msg}', // you can add more context to the log, just add [{context}] here :)
                        errorLikeObjectKeys: ['err', 'error']
                    }
                }
            })
        }

        return pino(baseConfig)
    }

    /**
     * Log methods with metadata support
     */
    debug(message: string, metadata?: LoggerMetadata): void {
        this.logger.debug(metadata || {}, message)
    }

    info(message: string, metadata?: LoggerMetadata): void {
        this.logger.info(metadata || {}, message)
    }

    warn(message: string, metadata?: LoggerMetadata): void {
        this.logger.warn(metadata || {}, message)
    }

    error(message: string, error?: Error | unknown, metadata?: LoggerMetadata): void {
        const errorObj =
            error instanceof Error
                ? {
                      err: {
                          message: error.message,
                          stack: error.stack,
                          name: error.name
                      }
                  }
                : error
                  ? { error }
                  : {}

        this.logger.error({ ...errorObj, ...metadata }, message)
    }

    fatal(message: string, error?: Error | unknown, metadata?: LoggerMetadata): void {
        const errorObj =
            error instanceof Error
                ? {
                      err: {
                          message: error.message,
                          stack: error.stack,
                          name: error.name
                      }
                  }
                : error
                  ? { error }
                  : {}

        this.logger.fatal({ ...errorObj, ...metadata }, message)

        if (process.env.NODE_ENV === 'production') {
            process.exit(1)
        }
    }

    child(bindings: LoggerMetadata): Logger {
        const childLogger = Object.create(this)
        childLogger.logger = this.logger.child(bindings)
        return childLogger
    }

    /**
     * Get the underlying Pino logger instance
     */
    getPinoInstance(): PinoLogger {
        return this.logger
    }
}

/**
 * Factory function to create a logger instance
 * @param context - The context/module name for the logger
 * @param options - Optional configuration for the logger
 */
export function createLogger(context: string, options?: LoggerConfig): Logger {
    return Logger.getInstance(context, options)
}

// Default logger instance
export const defaultLogger = createLogger('App')
