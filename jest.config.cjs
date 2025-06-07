module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transform: {
        '^.+\\.ts$': [
            'ts-jest',
            {
                tsconfig: {
                    outDir: './dist',
                    rootDir: './',
                    module: 'CommonJS',
                    target: 'ES2022'
                }
            }
        ]
    }
}
