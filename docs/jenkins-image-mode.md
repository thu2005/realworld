# Jenkins image lifecycle - Person E Week5

## Scope

`RUN_MODE=source` preserves the existing checkout/install/lint/Mocha/build pipeline. `RUN_MODE=image` consumes a RealWorld image, runs an isolated smoke test and publishes results without rebuilding source. Application source and tests remain the work of their original authors.

The application container is temporary for seminar verification, not a production deployment. The pipeline/script must come from trusted Jenkins SCM; `SUT_REPO_URL` is not used to load lifecycle code in image mode.

## Docker access

`jenkins/Dockerfile` adds the Docker CLI. Compose mounts the Linux Docker socket and adds `${DOCKER_GID:-0}` as a supplementary group. Verify the actual socket GID and set `DOCKER_GID` when needed; do not make the socket world writable or run the Jenkins service as root to bypass permissions.

The socket grants control of the host daemon: use trusted local seminar jobs only. Jenkins binds to `127.0.0.1:${JENKINS_HTTP_PORT:-18080}`, not all host interfaces. No Docker daemon TCP endpoint is opened.

```bash
docker compose -f docker-compose.jenkins.yml config --quiet
docker compose -f docker-compose.jenkins.yml up -d --build
docker compose -f docker-compose.jenkins.yml exec jenkins docker version
```

Keep the existing named volume. Do not run `down --volumes`. Start with the original setup guide for a new instance's administrator account. Configure the job using Pipeline from SCM and the branch containing the reviewed Jenkinsfile; after merge use `*/next`.

If automatic plugin mirrors time out, the optional build argument selects another download base, without disabling verification or skipping plugins:

```bash
docker compose -f docker-compose.jenkins.yml build --build-arg JENKINS_PLUGIN_DOWNLOAD_URL=https://archives.jenkins.io/plugins jenkins
docker compose -f docker-compose.jenkins.yml up -d --no-build
```

The override uses the [official plugin manager download option](https://github.com/jenkinsci/plugin-installation-manager-tool/blob/master/README.md) and Jenkins' [reference archive server](https://www.jenkins.io/download/mirrors/). Leave it empty to retain the default mirror selection.

If Java's downloader still fails while curl can reach the same server, use the optional transport fallback:

```bash
docker compose -f docker-compose.jenkins.yml build --build-arg JENKINS_PLUGIN_INSTALLER=curl jenkins
```

This still uses the official plugin manager to resolve dependencies, downloads the exact versions with curl/resume, and verifies every SHA-256 against official update metadata. A mismatch fails the build. A BuildKit cache retains partial downloads. The default remains the plugin manager; the fallback does not skip failed plugins.

## Parameters

| Parameter | Meaning |
|---|---|
| `RUN_MODE` | `source` (default) or `image` |
| `SUT_REPO_URL`, `SUT_REF` | Original source inputs; default ref is now `next`; Actions supplies source SHA for traceability |
| `IMAGE_REPO` | `ghcr.io/thu2005/realworld`; must match trusted `ALLOWED_IMAGE_REPO` in Jenkinsfile |
| `IMAGE_TAG` | Lowercase full 40-character source commit SHA; `latest` is rejected |
| `PULL_IMAGE` | `true` for registry handoff; `false` only for a prebuilt local verification image |
| `GHCR_PRIVATE` | Set true to use Jenkins username/password credential `ghcr-credentials` for registry pull |
| `SMOKE_TIMEOUT_SECONDS` | 1–300 seconds, default 120 |
| `SMOKE_PATH` | `/api/tags`; an alternate absolute path is only for controlled failure demonstrations |

Image mode fails on invalid/missing inputs; it never falls back to source or a different tag. Private credentials are passed using password-stdin; Docker config is temporary, outside archived reports, and removed after pull. Do not print secrets.

## Lifecycle and reports

1. Prepare a clean workspace and trusted lifecycle script.
2. Validate parameters; verify Docker daemon access.
3. Pull the exact image reference and record image ID and registry digests. Local mode records `input_origin=local-only` and is not evidence of GHCR handoff.
4. Create a network and application container unique to job/build, labeled with ownership. Run using the inspected image ID, preserving SQLite development configuration and internal port 3000.
5. Start a probe container using Node from that same image. Call the application on its private network; require HTTP 200 and a JSON `tags` array, with bounded retries/request timeouts.
6. In post action, collect diagnostics, remove owned app/probe containers and network, then publish JUnit and archive reports even if earlier stages failed.

No host port is needed for smoke testing. Jenkins localhost is not the sibling container. No workspace bind mount is used for the probe, avoiding Docker host/container path mismatches.

| Artifact | Purpose |
|---|---|
| `test-reports/junit/smoke.xml` | Lifecycle stage results, including failed pull/validation/smoke and cleanup; not a rerun of unit/API tests |
| `test-reports/logs/integration-summary.json` | Image reference, source SHA, image ID/digests, build URL, stage results and cleanup result |
| `test-reports/logs/container.log` | App stdout/stderr when a container exists |
| `test-reports/logs/container-inspect.json` | Container diagnostics when available |
| `test-reports/logs/smoke-response.json` | Last probe outcome/HTTP body when the probe ran |
| `test-reports/logs/pull.log` | Successful registry pull output |

Cleanup only removes resources carrying the current run's ownership label, never prunes the host or removes shared images/volumes. A cleanup failure is visible; it cannot turn an earlier failure into success.

## Handoff to the Actions integrator

The existing workflow's trigger skeleton still needs work by its owner:

- Send `RUN_MODE=image`, `IMAGE_REPO`, full SHA `IMAGE_TAG`, `PULL_IMAGE=true`, `GHCR_PRIVATE` as appropriate, and `SUT_REF=<source SHA>`.
- Only trigger after successful image push from a trusted event/ref. PRs and skipped/failed upstream jobs do not trigger this job.
- Create the response directory, check HTTP errors, retain the queue URL, wait for a build URL and final result with a timeout. Do not use `|| true` to hide integration failures.
- Link the Jenkins build in the Actions summary; make downstream failure visible.
- Use one trigger mechanism for the integration job. `githubPush()` was removed from Jenkinsfile; also disable any old push/polling trigger still stored in job configuration.

GitHub-hosted runners cannot reach localhost. Network access and Secrets must be supplied by the team before claiming automatic end-to-end success. Manual/local verification alone is not that claim.

## Verification checklist

- Valid image: lifecycle succeeds, JUnit/logs are downloadable, no build containers/networks remain.
- Missing tag: pull fails clearly and diagnostics are retained.
- Invalid parameters: fail before image execution.
- Wrong smoke path or unhealthy app: bounded failure, logs retained, resources removed.
- Source regression: original pipeline still runs on the selected ref.
- End-to-end: Actions run and Jenkins build agree on image SHA; downstream failure reaches Actions.
