# Jenkins Cypress and Allure setup

This is the Week 6 UI-test extension of the existing image-mode pipeline. It
keeps the seminar setup small: Jenkins runs Cypress itself and temporarily
joins the private Docker network that already contains the RealWorld SUT.
No application port is published on the host.

## Components

- Cypress `9.7.0` and `@shelex/cypress-allure-plugin` `2.22.0` are installed
  in the custom Jenkins image. They are pinned because the application and
  source pipeline use Node.js 14.
- The Jenkins plugin `allure-jenkins-plugin` is installed from
  `jenkins/plugins.txt`.
- `jenkins/init.groovy.d/configure-allure.groovy` creates an Allure commandline
  tool named `allure` when it is missing. Existing tool configuration is kept.
- `cypress/e2e/public-ui.spec.js` contains two non-destructive public UI smoke
  tests. Other team members can add specs under the same folder.

## Rebuild and verify Jenkins

Keep the existing named volume so Jenkins accounts, jobs and history remain:

```bash
docker compose -f docker-compose.jenkins.yml build jenkins
docker compose -f docker-compose.jenkins.yml up -d --no-build --force-recreate jenkins
docker compose -f docker-compose.jenkins.yml exec jenkins cypress verify
```

Open **Manage Jenkins → Plugins → Installed plugins** and confirm `Allure` is
present. Open **Manage Jenkins → Tools** and confirm the Allure commandline
installation is named `allure`. The first report publication may download the
recommended Allure 2 commandline into the persistent Jenkins volume.

## Pipeline run

Run `ci-cd-demo` with these parameters:

| Parameter | Value |
|---|---|
| `RUN_MODE` | `image` |
| `IMAGE_REPO` | `ghcr.io/thu2005/realworld` |
| `IMAGE_TAG` | full 40-character commit SHA |
| `PULL_IMAGE` | `true` |
| `GHCR_PRIVATE` | `false` for the current public package |

The relevant stages are:

```text
Pull image → Run image → Smoke test → Connect UI test runner
           → Cypress UI tests → Allure report → cleanup/artifacts
```

Expected output paths:

- `test-reports/allure-results/`
- `test-reports/cypress/screenshots/`
- `test-reports/cypress/videos/`
- `test-reports/junit/`
- `test-reports/logs/`

Allure publication, JUnit publication, artifact archival and Docker cleanup run
from post actions, including when a UI test fails.

## Credentials

For the public GHCR package, keep `GHCR_PRIVATE=false`; no registry credential
is needed. If the package becomes private, create this Jenkins credential:

| Field | Value |
|---|---|
| Kind | Username with password |
| ID | `ghcr-credentials` |
| Username | GitHub account that can read the package |
| Password | GitHub token with package read permission |

The token value must only be entered in Jenkins Credentials. Do not add it to
the Jenkinsfile, documentation, screenshots or console output.

For GitHub Actions to trigger Jenkins, configure repository secrets
`JENKINS_URL`, `JENKINS_USER` and `JENKINS_TOKEN`. A GitHub-hosted runner cannot
reach `localhost:18080`; automatic triggering requires a team-approved reachable
Jenkins URL or a self-hosted runner. Manual **Build with Parameters** remains the
local seminar fallback.

## Troubleshooting

- Missing `allure` tool: restart the rebuilt Jenkins container once and check
  **Manage Jenkins → Tools**.
- Cypress cannot resolve the SUT name: inspect the build log for the
  `Connect UI test runner` stage and confirm post-cleanup removed the temporary
  `realworld-net-*` network.
- Cypress failure: download the archived screenshot/video and open the Allure
  link on the Jenkins build page.
- Never run `docker compose down --volumes` unless Jenkins data is intentionally
  being discarded.
