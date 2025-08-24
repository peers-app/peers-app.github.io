/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'scripts/**/*.ts',
    '!scripts/**/*.test.ts',
    '!scripts/setup-test-sources.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts']
};