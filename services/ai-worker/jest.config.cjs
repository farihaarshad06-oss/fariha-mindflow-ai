/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  passWithNoTests: true,
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { tsconfig: { module: 'CommonJS', target: 'ES2022', moduleResolution: 'Node', esModuleInterop: true, strict: true } },
    ],
  },
};
