module.exports = {
  testEnvironment: 'node',
  testTimeout: 20000,
  collectCoverageFrom: [
    'lib.js',
    'auth.js'
  ],
  coverageReporters: [
    'text',
    'lcov',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: process.env.JEST_JUNIT_OUTPUT_DIR || 'test-reports/junit',
        outputName: process.env.JEST_JUNIT_OUTPUT_NAME || 'jest-unit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: 'true'
      }
    ]
  ]
};
