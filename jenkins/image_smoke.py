#!/usr/bin/env python3
"""Jenkins image lifecycle. Each command is a pipeline stage; finalize is idempotent."""
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

STATE = Path('.jenkins-integration-state.json')
REPORTS = Path('test-reports')
LOGS = REPORTS / 'logs'
OWNER_LABEL = 'realworld.integration.run'

# Run in a sibling container: localhost in Jenkins is not the application.
# Reuse Node from the exact application image, avoiding an extra probe image.
PROBE = r'''
const http = require('http');
const url = process.argv[1];
const deadline = Date.now() + Number(process.argv[2]) * 1000;
let last = 'No HTTP response';
function done(ok, data) {
  process.stdout.write(JSON.stringify({ok, detail: data}) + '\n');
  process.exit(ok ? 0 : 1);
}
function attempt() {
  if (Date.now() >= deadline) return done(false, last);
  const req = http.get(url, res => {
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (res.statusCode === 200 && Array.isArray(data.tags)) {
          return done(true, {status: res.statusCode, body: data});
        }
        last = {status: res.statusCode, body: body.slice(0, 2048)};
      } catch (err) { last = {status: res.statusCode, body: body.slice(0, 2048)}; }
      setTimeout(attempt, 1000);
    });
  });
  req.setTimeout(Math.max(1, Math.min(3000, deadline - Date.now())), () => {
    req.destroy(new Error('HTTP request timeout'));
  });
  req.on('error', err => { last = err.message; setTimeout(attempt, 1000); });
}
attempt();
'''


def docker(*args, check=True, timeout=90):
    result = subprocess.run(['docker', *args], text=True, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError('docker {}: {}'.format(args[0], result.stderr.strip()))
    return result


def save(state):
    STATE.write_text(json.dumps(state, indent=2), encoding='utf-8')
    LOGS.mkdir(parents=True, exist_ok=True)
    (LOGS / 'integration-summary.json').write_text(json.dumps(state, indent=2), encoding='utf-8')


def read_state():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding='utf-8'))
    run = '{}:{}'.format(os.environ.get('JOB_NAME', 'local'),
                         os.environ.get('BUILD_NUMBER', str(os.getpid())))
    owner = hashlib.sha256(run.encode()).hexdigest()[:16]
    return {'owner': owner, 'container': 'realworld-sut-' + owner,
            'network': 'realworld-net-' + owner, 'probe': 'realworld-probe-' + owner,
            'build_url': os.environ.get('BUILD_URL', ''), 'checks': []}


def validate(state):
    repo = os.environ.get('IMAGE_REPO', '').strip()
    tag = os.environ.get('IMAGE_TAG', '').strip()
    allowed = os.environ.get('ALLOWED_IMAGE_REPO', 'ghcr.io/thu2005/realworld')
    if repo != allowed or not re.fullmatch(r'ghcr\.io/[a-z0-9._/-]+', repo):
        raise ValueError('IMAGE_REPO must match the trusted ALLOWED_IMAGE_REPO')
    if not re.fullmatch(r'[0-9a-f]{40}', tag):
        raise ValueError('IMAGE_TAG must be a lowercase full 40-character commit SHA')
    timeout = int(os.environ.get('SMOKE_TIMEOUT_SECONDS', '120'))
    if not 1 <= timeout <= 300:
        raise ValueError('SMOKE_TIMEOUT_SECONDS must be between 1 and 300')
    path = os.environ.get('SMOKE_PATH', '/api/tags')
    if not re.fullmatch(r'/[a-zA-Z0-9/_-]*', path):
        raise ValueError('SMOKE_PATH must be an absolute HTTP path')
    state.update(image=repo + ':' + tag, source_sha=tag, timeout=timeout,
                 smoke_path=path, pull_image=os.environ.get('PULL_IMAGE', 'true').lower() == 'true')


def pull(state):
    if state['pull_image']:
        result = docker('pull', state['image'], timeout=600)
        (LOGS / 'pull.log').write_text(result.stdout + result.stderr, encoding='utf-8')
    info = json.loads(docker('image', 'inspect', state['image']).stdout)[0]
    state.update(image_id=info['Id'], repo_digests=info.get('RepoDigests', []),
                 input_origin='registry' if state['pull_image'] else 'local-only')


def start(state):
    docker('network', 'create', '--label', OWNER_LABEL + '=' + state['owner'], state['network'])
    docker('run', '-d', '--name', state['container'], '--network', state['network'],
           '--label', OWNER_LABEL + '=' + state['owner'],
           '--env', 'PORT=3000', '--env', 'NODE_ENV=development', state['image_id'])


def connect_agent(state):
    """Connect this trusted Jenkins container to the private SUT network."""
    if not owned(state, 'network', state['network']):
        raise RuntimeError('SUT network does not exist')
    agent = socket.gethostname()
    docker('container', 'inspect', agent)
    docker('network', 'connect', state['network'], agent)
    state['jenkins_container'] = agent
    state['base_url'] = 'http://{}:3000'.format(state['container'])


def smoke(state):
    url = 'http://{}:3000{}'.format(state['container'], state['smoke_path'])
    result = docker('run', '--rm', '--name', state['probe'], '--network', state['network'],
                    '--label', OWNER_LABEL + '=' + state['owner'], '--entrypoint', 'node',
                    state['image_id'], '-e', PROBE, url, str(state['timeout']),
                    check=False, timeout=state['timeout'] + 20)
    (LOGS / 'smoke-response.json').write_text(result.stdout, encoding='utf-8')
    if result.returncode:
        raise RuntimeError('Smoke failed: ' + (result.stdout + result.stderr).strip())
    data = json.loads(result.stdout)
    if not data.get('ok'):
        raise RuntimeError('Smoke returned no success result')


def owned(state, kind, name):
    result = docker(kind, 'inspect', name, check=False)
    if result.returncode:
        if 'No such' in result.stderr or 'not found' in result.stderr:
            return False
        raise RuntimeError(result.stderr.strip())
    info = json.loads(result.stdout)[0]
    labels = info.get('Labels', {}) if kind == 'network' else info.get('Config', {}).get('Labels', {})
    if (labels or {}).get(OWNER_LABEL) != state['owner']:
        raise RuntimeError('Refusing to remove resource owned by another run: ' + name)
    return True


def finalize(state):
    errors = []
    upstream_result = os.environ.get('INTEGRATION_PIPELINE_RESULT', 'SUCCESS')
    state['jenkins_result_before_cleanup'] = upstream_result
    if upstream_result != 'SUCCESS' and not any(not c['ok'] for c in state['checks']):
        state['checks'].append({'phase': 'pipeline', 'ok': False, 'seconds': 0,
                                'error': 'Jenkins failed outside lifecycle script: ' + upstream_result})
    # Collect first, remove each resource independently even if another step fails.
    for name in (state['container'], state['probe']):
        remove = False
        try:
            if owned(state, 'container', name):
                remove = True
                if name == state['container']:
                    result = docker('logs', name, check=False)
                    (LOGS / 'container.log').write_text(result.stdout + result.stderr, encoding='utf-8')
                    info = docker('container', 'inspect', name).stdout
                    (LOGS / 'container-inspect.json').write_text(info, encoding='utf-8')
        except Exception as exc:
            errors.append(str(exc))
        finally:
            if remove:
                try:
                    docker('rm', '-f', name)
                except Exception as exc:
                    errors.append(str(exc))
    agent = state.get('jenkins_container')
    if agent:
        try:
            if owned(state, 'network', state['network']):
                result = docker('network', 'disconnect', state['network'], agent,
                                check=False)
                if result.returncode and 'not connected' not in result.stderr.lower():
                    errors.append(result.stderr.strip())
        except Exception as exc:
            errors.append(str(exc))
    try:
        if owned(state, 'network', state['network']):
            docker('network', 'rm', state['network'])
    except Exception as exc:
        errors.append(str(exc))
    state['cleanup_complete'] = not errors
    if errors:
        raise RuntimeError('; '.join(errors))


def junit(state):
    checks = state['checks']
    suite = ET.Element('testsuite', name='RealWorld image integration', tests=str(len(checks)),
                       failures=str(sum(not c['ok'] for c in checks)))
    for check in checks:
        case = ET.SubElement(suite, 'testcase', classname='jenkins.image', name=check['phase'],
                             time=str(check['seconds']))
        if not check['ok']:
            ET.SubElement(case, 'failure', message=check['error']).text = check['error']
    target = REPORTS / 'junit' / 'smoke.xml'
    target.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(suite).write(target, encoding='utf-8', xml_declaration=True)


def main():
    phase = sys.argv[1]
    actions = {'validate': validate, 'pull': pull, 'start': start,
               'smoke': smoke, 'connect-agent': connect_agent, 'finalize': finalize}
    state = read_state()
    LOGS.mkdir(parents=True, exist_ok=True)
    began = time.monotonic()
    error = ''
    # Save planned names before Docker creates resources, so post can recover on abort.
    save(state)
    try:
        actions[phase](state)
    except Exception as exc:
        error = str(exc)
        print(error, file=sys.stderr)
    state['checks'].append({'phase': phase, 'ok': not error, 'error': error,
                            'seconds': round(time.monotonic() - began, 3)})
    state['result'] = 'FAILURE' if any(not c['ok'] for c in state['checks']) else 'SUCCESS'
    save(state)
    junit(state)
    print('{}: {}'.format(phase, 'FAILURE' if error else 'SUCCESS'))
    return 1 if error else 0


if __name__ == '__main__':
    sys.exit(main())
