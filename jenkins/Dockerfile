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
        libasound2t64 \
        libgbm-dev \
        libgtk-3-0t64 \
        libnotify-dev \
        libnss3 \
        libxss1 \
        libxtst6 \
        python3 \
        python-is-python3 \
        unzip \
        xauth \
        xvfb \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node-runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version \
    && npm --version

# The application is pinned to Node 14, so Cypress is pinned to the last
# project generation used by this seminar instead of following latest.
ARG CYPRESS_VERSION=9.7.0
ARG CYPRESS_ALLURE_PLUGIN_VERSION=2.22.0
ENV CYPRESS_CACHE_FOLDER=/opt/cypress-cache \
    NODE_PATH=/usr/local/lib/node_modules
RUN mkdir -p "$CYPRESS_CACHE_FOLDER" \
    && CYPRESS_INSTALL_BINARY=0 npm install --global \
        "cypress@${CYPRESS_VERSION}" \
        "@shelex/cypress-allure-plugin@${CYPRESS_ALLURE_PLUGIN_VERSION}" \
    && cypress install --force \
    && chown -R jenkins:jenkins "$CYPRESS_CACHE_FOLDER"

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

COPY --chown=jenkins:jenkins jenkins/init.groovy.d/ /usr/share/jenkins/ref/init.groovy.d/

USER jenkins

RUN cypress verify
