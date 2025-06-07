export type ConnectionStatus = 'open' | 'close' | 'connecting'

export interface ConnectionInfo {
    id: string | null
    lastLogin: Date | null
    connectedAt: Date | null
    status: ConnectionStatus
}

let info: ConnectionInfo = {
    id: null,
    lastLogin: null,
    connectedAt: null,
    status: 'close'
}

export function setStatus(status: ConnectionStatus, id?: string | null) {
    info.status = status
    if (id !== undefined) {
        info.id = id
    }
    if (status === 'open') {
        info.lastLogin = new Date()
        info.connectedAt = new Date()
    } else if (status === 'close') {
        info.connectedAt = null
    }
}

export function getInfo(): ConnectionInfo {
    return { ...info }
}
