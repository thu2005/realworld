module.exports = {
  testEnvironment: 'node',
  testTimeout: 20000,
  collectCoverageFrom: [
    'lib.js',
    'auth.js',
    'models/user.js',
    'models/article.js'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
