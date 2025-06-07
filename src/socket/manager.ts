import { WASocket } from 'baileys'

let currentSocket: WASocket | null = null

export function setSocket(sock: WASocket | null) {
    currentSocket = sock
}

export function getSocket(): WASocket | null {
    return currentSocket
}

export async function disconnectSocket() {
    if (currentSocket) {
        await currentSocket.logout()
    }
}
