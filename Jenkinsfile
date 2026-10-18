pipeline {
  agent any

  options {
    skipDefaultCheckout(true)
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 30, unit: 'MINUTES')
  }

  triggers {
    githubPush()
  }

  parameters {
    string(
      name: 'SUT_REPO_URL',
      defaultValue: 'https://github.com/thu2005/realworld.git',
      description: 'Public RealWorld repository URL'
    )
    string(
      name: 'SUT_REF',
      defaultValue: 'jenkins',
      description: 'Branch, tag, or commit to test'
    )
  }

  environment {
    CI = 'true'
    TEST_REPORT_DIR = 'test-reports'
  }

  stages {
    stage('Checkout') {
      steps {
        deleteDir()
        sh '''
          set -eu
          git init
          git remote add origin "$SUT_REPO_URL"
          git fetch --depth=1 origin "$SUT_REF"
          git checkout --detach FETCH_HEAD
          git submodule update --init --recursive
          git rev-parse HEAD
          git submodule status
        '''
      }
    }

    stage('Verify runtime') {
      steps {
        sh '''
          set -eu
          test "$(node --version)" = "v14.21.3"
          test "$(npm --version)" = "6.14.18"
          node --version
          npm --version
        '''
      }
    }

    stage('Install') {
      steps {
        sh '''
          set -eu
          npm cache clean --force
          npm install --no-audit --no-fund
        '''
      }
    }

    stage('Lint') {
      steps {
        sh 'npm run lint'
      }
    }

    stage('Test') {
      steps {
        sh '''
          set -eu
          mkdir -p "$TEST_REPORT_DIR/junit"
          npm test -- \
            --reporter xunit \
            --reporter-option "output=$TEST_REPORT_DIR/junit/mocha.xml"
        '''
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build-dev'
      }
    }
  }

  post {
    always {
      junit testResults: 'test-reports/junit/*.xml', allowEmptyResults: true
      archiveArtifacts artifacts: 'test-reports/**/*', allowEmptyArchive: true
    }
  }
}
