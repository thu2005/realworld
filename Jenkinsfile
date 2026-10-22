pipeline {
  agent any

  options {
    skipDefaultCheckout(true)
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '10'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    choice(name: 'RUN_MODE', choices: ['source', 'image'], description: 'Source baseline or GHCR image smoke test')
    string(name: 'IMAGE_REPO', defaultValue: 'ghcr.io/thu2005/realworld', description: 'Trusted application image repository')
    string(name: 'IMAGE_TAG', defaultValue: '', description: 'Full 40-character source commit SHA')
    booleanParam(name: 'PULL_IMAGE', defaultValue: true, description: 'Keep enabled for GHCR handoff; disable only for a local image test')
    booleanParam(name: 'GHCR_PRIVATE', defaultValue: false, description: 'Use Jenkins ghcr-credentials to pull a private image')
    string(name: 'SMOKE_TIMEOUT_SECONDS', defaultValue: '120', description: 'Readiness timeout, 1 to 300 seconds')
    string(name: 'SMOKE_PATH', defaultValue: '/api/tags', description: 'Smoke endpoint; alternate path is for controlled failure tests')
    string(
      name: 'SUT_REPO_URL',
      defaultValue: 'https://github.com/thu2005/realworld.git',
      description: 'Public RealWorld repository URL'
    )
    string(
      name: 'SUT_REF',
      defaultValue: 'next',
      description: 'Branch, tag, or commit to test'
    )
  }

  environment {
    CI = 'true'
    TEST_REPORT_DIR = 'test-reports'
    ALLOWED_IMAGE_REPO = 'ghcr.io/thu2005/realworld'
  }

  stages {
    stage('Prepare image workspace') {
      when { expression { params.RUN_MODE == 'image' } }
      steps {
        deleteDir()
        // Use trusted pipeline SCM, not user-supplied SUT source, for lifecycle code.
        checkout scm
      }
    }

    stage('Validate image input') {
      when { expression { params.RUN_MODE == 'image' } }
      steps { sh 'python3 jenkins/image_smoke.py validate' }
    }

    stage('Verify Docker') {
      when { expression { params.RUN_MODE == 'image' } }
      steps { sh 'docker version && docker info --format "{{.OSType}}"' }
    }

    stage('Pull image') {
      when { expression { params.RUN_MODE == 'image' } }
      steps {
        script {
          if (params.GHCR_PRIVATE && params.PULL_IMAGE) {
            def authDir = "${pwd(tmp: true)}/ghcr-auth"
            try {
              withEnv(["DOCKER_CONFIG=${authDir}"]) {
                withCredentials([usernamePassword(credentialsId: 'ghcr-credentials', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_TOKEN')]) {
                  sh '''
                    set +x
                    mkdir -p "$DOCKER_CONFIG"
                    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin
                  '''
                  sh 'python3 jenkins/image_smoke.py pull'
                }
              }
            } finally {
              dir(authDir) { deleteDir() }
            }
          } else {
            sh 'python3 jenkins/image_smoke.py pull'
          }
        }
      }
    }

    stage('Run image') {
      when { expression { params.RUN_MODE == 'image' } }
      steps { sh 'python3 jenkins/image_smoke.py start' }
    }

    stage('Smoke test') {
      when { expression { params.RUN_MODE == 'image' } }
      steps { sh 'python3 jenkins/image_smoke.py smoke' }
    }

    stage('Checkout') {
      when { expression { params.RUN_MODE == 'source' } }
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
      when { expression { params.RUN_MODE == 'source' } }
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
      when { expression { params.RUN_MODE == 'source' } }
      steps {
        sh '''
          set -eu
          npm cache clean --force
          npm install --no-audit --no-fund
        '''
      }
    }

    stage('Lint') {
      when { expression { params.RUN_MODE == 'source' } }
      steps {
        sh 'npm run lint'
      }
    }

    stage('Test') {
      when { expression { params.RUN_MODE == 'source' } }
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
      when { expression { params.RUN_MODE == 'source' } }
      steps {
        sh 'npm run build-dev'
      }
    }
  }

  post {
    always {
      script {
        try {
          if (params.RUN_MODE == 'image' && fileExists('.jenkins-integration-state.json')) {
            withEnv(["INTEGRATION_PIPELINE_RESULT=${currentBuild.currentResult}"]) {
              sh 'python3 jenkins/image_smoke.py finalize'
            }
          }
        } finally {
          try {
            junit testResults: 'test-reports/junit/*.xml', allowEmptyResults: true
          } finally {
            archiveArtifacts artifacts: 'test-reports/**/*', allowEmptyArchive: true
          }
        }
      }
    }
  }
}
