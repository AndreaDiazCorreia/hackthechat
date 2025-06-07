let currentQR: string | null = null

export function setCurrentQR(qr: string | null): void {
    currentQR = qr
}

export function getCurrentQR(): string | null {
    return currentQR
}
