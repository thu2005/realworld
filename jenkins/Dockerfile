# syntax=docker/dockerfile:1

FROM node:14.21.3-bullseye-slim AS node-runtime
FROM docker:27.5.1-cli AS docker-cli

FROM jenkins/jenkins:lts-jdk21 AS runtime

USER root

RUN apt-get update \
    && apt-get install --yes --no-install-recommends \
        build-essential \
        ca-certificates \
        curl \
        git \
        python3 \
        python-is-python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version \
    && npm --version

COPY --chown=jenkins:jenkins jenkins/plugins.txt /usr/share/jenkins/ref/plugins.txt

FROM runtime AS final

COPY jenkins/download_plugins.py /usr/local/bin/download-jenkins-plugins.py
ARG JENKINS_PLUGIN_DOWNLOAD_URL=""
ARG JENKINS_PLUGIN_INSTALLER="manager"
RUN --mount=type=cache,target=/var/cache/jenkins-plugins \
    if [ -n "$JENKINS_PLUGIN_DOWNLOAD_URL" ]; then \
      export JENKINS_UC_DOWNLOAD_URL="$JENKINS_PLUGIN_DOWNLOAD_URL"; \
    fi \
    && if [ "$JENKINS_PLUGIN_INSTALLER" = "curl" ]; then \
      jenkins-plugin-cli --no-download --list --plugin-file /usr/share/jenkins/ref/plugins.txt > /tmp/resolved-plugins.txt \
      && python3 /usr/local/bin/download-jenkins-plugins.py /tmp/resolved-plugins.txt /var/cache/jenkins-plugins /usr/share/jenkins/ref/plugins; \
    elif [ "$JENKINS_PLUGIN_INSTALLER" = "manager" ]; then \
      jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt; \
    else echo 'Unknown JENKINS_PLUGIN_INSTALLER' >&2; exit 1; fi

USER jenkins
