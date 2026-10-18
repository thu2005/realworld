#!/usr/bin/env python3
"""Optional curl transport for the official plugin resolver's output, with SHA-256 verification."""
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


def fetch(url, target, resume=False):
    args = ['curl', '--fail', '--location', '--silent', '--show-error', '--retry', '2',
            '--max-time', '600']
    if resume:
        args += ['--continue-at', '-']
    subprocess.run(args + [url, '--output', str(target)], check=True)


def main():
    resolved, destination = Path(sys.argv[1]), Path(sys.argv[2])
    destination.mkdir(parents=True, exist_ok=True)
    requested = dict(re.findall(r'^([a-z0-9][a-z0-9-]*) ([0-9][a-zA-Z0-9_.-]*)$',
                               resolved.read_text(encoding='utf-8'), re.M))
    if not requested:
        raise RuntimeError('No plugins resolved; refusing an empty installation')
    with tempfile.TemporaryDirectory() as temporary:
        metadata = Path(temporary) / 'update.json'
        fetch('https://updates.jenkins.io/current/update-center.actual.json', metadata)
        available = json.loads(metadata.read_text(encoding='utf-8'))['plugins']
    base = os.environ.get('JENKINS_UC_DOWNLOAD_URL') or 'https://archives.jenkins.io/plugins'

    def install(item):
        name, version = item
        info = available[name]
        if info['version'] != version:
            raise RuntimeError('Metadata version changed for ' + name + '; resolve again')
        expected = base64.b64decode(info['sha256'])
        path = destination / (name + '.jpi')
        if path.exists() and hashlib.sha256(path.read_bytes()).digest() == expected:
            return name
        if path.exists() and path.stat().st_size >= info['size']:
            path.unlink()
        fetch('{}/{}/{}/{}.hpi'.format(base.rstrip('/'), name, version, name), path, resume=True)
        if hashlib.sha256(path.read_bytes()).digest() != expected:
            raise RuntimeError('Plugin checksum mismatch: ' + name)
        return name

    with ThreadPoolExecutor(max_workers=6) as pool:
        tasks = [pool.submit(install, item) for item in requested.items()]
        for index, task in enumerate(as_completed(tasks), 1):
            print('{}/{} verified: {}'.format(index, len(tasks), task.result()), flush=True)
    if len(sys.argv) > 3:
        output = Path(sys.argv[3])
        output.mkdir(parents=True, exist_ok=True)
        for name in requested:
            shutil.copy2(destination / (name + '.jpi'), output / (name + '.jpi'))


if __name__ == '__main__':
    main()
