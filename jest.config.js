module.exports = {
  testEnvironment: 'node',
  testTimeout: 20000,
  collectCoverageFrom: [
    'lib.js',
    'auth.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
