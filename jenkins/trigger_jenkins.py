#!/usr/bin/env python3
"""Trigger a parameterized Jenkins build and propagate its final result."""
import base64
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


REPORT = Path('test-reports/jenkins-result.json')
QUEUE_TIMEOUT_SECONDS = 300
BUILD_TIMEOUT_SECONDS = 1800


def required(name):
    value = os.environ.get(name, '').strip()
    if not value:
        raise RuntimeError('{} must be configured in the environment'.format(name))
    return value


def auth_header(user, token):
    raw = '{}:{}'.format(user, token).encode('utf-8')
    return 'Basic ' + base64.b64encode(raw).decode('ascii')


def request(url, authorization, data=None):
    headers = {'Authorization': authorization, 'Accept': 'application/json'}
    body = None
    if data is not None:
        body = urlencode(data).encode('utf-8')
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    req = Request(url, data=body, headers=headers, method='POST' if body else 'GET')
    try:
        return urlopen(req, timeout=30)
    except HTTPError as exc:
        detail = exc.read(2048).decode('utf-8', errors='replace').strip()
        raise RuntimeError('Jenkins returned HTTP {}: {}'.format(exc.code, detail))
    except URLError as exc:
        raise RuntimeError('Cannot reach Jenkins: {}'.format(exc.reason))


def get_json(url, authorization):
    with request(url, authorization) as response:
        return json.loads(response.read().decode('utf-8'))


def wait_for_build(queue_url, authorization):
    deadline = time.monotonic() + QUEUE_TIMEOUT_SECONDS
    api_url = urljoin(queue_url.rstrip('/') + '/', 'api/json')
    while time.monotonic() < deadline:
        data = get_json(api_url, authorization)
        if data.get('cancelled'):
            raise RuntimeError('Jenkins cancelled the queued build')
        executable = data.get('executable') or {}
        if executable.get('url'):
            return executable['url']
        time.sleep(3)
    raise RuntimeError('Timed out waiting for Jenkins to assign a build')


def wait_for_result(build_url, authorization):
    deadline = time.monotonic() + BUILD_TIMEOUT_SECONDS
    api_url = urljoin(build_url.rstrip('/') + '/', 'api/json')
    while time.monotonic() < deadline:
        data = get_json(api_url, authorization)
        if not data.get('building', False) and data.get('result'):
            return data['result']
        time.sleep(10)
    raise RuntimeError('Timed out waiting for Jenkins build result')


def write_report(data):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(data, indent=2), encoding='utf-8')


def main():
    # A failed request must never leave a previous successful result behind.
    if REPORT.exists():
        REPORT.unlink()
    base_url = required('JENKINS_URL').rstrip('/') + '/'
    user = required('JENKINS_USER')
    token = required('JENKINS_TOKEN')
    job = os.environ.get('JENKINS_JOB', 'ci-cd-demo').strip()
    image_repo = required('IMAGE_REPO')
    image_tag = required('IMAGE_TAG')
    source_url = required('SUT_REPO_URL')
    source_ref = required('SUT_REF')
    authorization = auth_header(user, token)

    endpoint = urljoin(base_url, 'job/{}/buildWithParameters'.format(job))
    parameters = {
        'RUN_MODE': 'image',
        'IMAGE_REPO': image_repo,
        'IMAGE_TAG': image_tag,
        'PULL_IMAGE': os.environ.get('PULL_IMAGE', 'true'),
        'GHCR_PRIVATE': os.environ.get('GHCR_PRIVATE', 'false'),
        'SUT_REPO_URL': source_url,
        'SUT_REF': source_ref,
    }
    # Optional overrides also allow the same client to demonstrate a failed gate.
    for name in ('SMOKE_PATH', 'SMOKE_TIMEOUT_SECONDS'):
        if name in os.environ:
            parameters[name] = os.environ[name]
    with request(endpoint, authorization, parameters) as response:
        queue_url = response.headers.get('Location', '')
    if not queue_url:
        raise RuntimeError('Jenkins accepted the request without a queue URL')

    print('Jenkins queue accepted: {}'.format(queue_url))
    build_url = wait_for_build(queue_url, authorization)
    print('Jenkins build started: {}'.format(build_url))
    result = wait_for_result(build_url, authorization)
    report = {
        'job': job,
        'build_url': build_url,
        'result': result,
        'image': '{}:{}'.format(image_repo, image_tag),
        'source_ref': source_ref,
    }
    write_report(report)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as output:
            output.write('### Jenkins downstream\n\n')
            output.write('- Build: [{}]({})\n'.format(build_url, build_url))
            output.write('- Image: `{}`\n'.format(report['image']))
            output.write('- Result: **{}**\n'.format(result))
    if result != 'SUCCESS':
        raise RuntimeError('Jenkins downstream result was {}'.format(result))


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as exc:
        print('ERROR: {}'.format(exc), file=sys.stderr)
        sys.exit(1)
