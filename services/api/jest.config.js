/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          module: 'CommonJS',
          target: 'ES2022',
          moduleResolution: 'Node',
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: ['node_modules/(?!(@mindflow)/)'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
};
