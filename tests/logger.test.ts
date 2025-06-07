import { createLogger } from '../src/logger/index'

describe('createLogger', () => {
    it('returns the same instance when called twice with the same context', () => {
        const first = createLogger('Test')
        const second = createLogger('Test')
        expect(first).toBe(second)
    })

    it('child returns a new instance distinct from the parent', () => {
        const parent = createLogger('Parent')
        const child = parent.child({ id: 1 })
        expect(child).not.toBe(parent)
    })
})