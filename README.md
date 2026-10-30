# RealWorld Conduit - Fullstack Example App with CI/CD Pipeline

[![CI Pipeline](https://github.com/thu2005/realworld/actions/workflows/ci.yml/badge.svg?branch=next)](https://github.com/thu2005/realworld/actions/workflows/ci.yml)
[![Coverage Status](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg)](https://github.com/thu2005/realworld/actions/workflows/ci.yml)
[![Unit Tests](https://img.shields.io/badge/Unit%20Tests-31%20passed-success.svg)](https://github.com/thu2005/realworld/actions/workflows/ci.yml)
[![API Tests](https://img.shields.io/badge/API%20Tests-15%20passed-success.svg)](https://github.com/thu2005/realworld/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/Node.js-14.21.3-blue.svg)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

An implementation of the [RealWorld](https://github.com/gothinkster/realworld) specification (Medium.com clone) featuring fullstack Node.js, Express, Sequelize, SQLite/PostgreSQL, and Next.js, equipped with automated CI/CD pipelines, multi-layer testing, and JUnit XML test reporting.

---

## 🧪 CI/CD Pipeline & Test Coverage Reports

| Component | Status / Badge | Test Scope & Reports |
|---|:---:|---|
| **GitHub Actions CI** | [![CI Pipeline](https://github.com/thu2005/realworld/actions/workflows/ci.yml/badge.svg?branch=next)](https://github.com/thu2005/realworld/actions/workflows/ci.yml) | Automated build, lint, Mocha + Jest unit tests, Newman + SuperTest API tests, security audit, Docker image |
| **Jest Unit Tests (Task C-1)** | [![Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen.svg)](https://github.com/thu2005/realworld/actions/workflows/ci.yml) | 31 unit tests covering models, auth helpers, utility functions (Statements: 100%, Lines: 100%, Functions: 100%, Branches: 94.73%) |
| **SuperTest API Tests (Task C-2)** | [![API Tests](https://img.shields.io/badge/SuperTest-15%20passed-success.svg)](https://github.com/thu2005/realworld/actions/workflows/ci.yml) | 15 integration tests covering Auth, User CRUD, Articles, Tags, Profiles, Comments |
| **JUnit XML Reporting (Task C-3)** | [![JUnit XML](https://img.shields.io/badge/JUnit%20XML-Configured-blue.svg)](https://github.com/thu2005/realworld/actions/workflows/ci.yml) | Standard JUnit XML output for CI & Jenkins (`test-reports/junit/jest-unit.xml`, `test-reports/junit/jest-api.xml`) |
| **Mocha & Newman Legacy** | [![Mocha & Newman](https://img.shields.io/badge/Mocha%20%26%20Newman-Passing-green.svg)](https://github.com/thu2005/realworld/actions/workflows/ci.yml) | Base application regression tests (`mocha.xml`, `newman.xml`) |

---

## 🚀 Quick Start & Local Testing

### Prerequisites
- Node.js `14.21.3`
- npm `6.14.18`

### Install Dependencies
```bash
npm install
```

### Run Tests with JUnit XML & Coverage Output
```bash
# Run unit tests with code coverage (outputs to console, coverage/ and test-reports/junit/jest-unit.xml)
npm run test:unit

# Run SuperTest API integration tests (outputs to test-reports/junit/jest-api.xml)
npm run test:api

# Run legacy Mocha unit tests
npm test
```

### View Reports
- **Unit Test Coverage Report**: `coverage/lcov-report/index.html`
- **JUnit XML Reports**: `test-reports/junit/*.xml`
- **CI Test Artifacts**: Downloadable on [GitHub Actions Workflow Runs](https://github.com/thu2005/realworld/actions/workflows/ci.yml)

---

## 📖 Documentation
- [CI/CD Integration Contract](CI_INTEGRATION_CONTRACT.md)
- [Jenkins Setup Guide](docs/jenkins-setup.md)
- [Full Application Documentation](README.adoc)
