#!/usr/bin/env python3
"""Run one seminar scenario against a real parameterized Jenkins job."""
import argparse
import json
import os
from pathlib import Path
import sys

import trigger_jenkins as client


def verify_result(scenario, report, lifecycle):
    expected = 'SUCCESS' if scenario == 'pass' else 'FAILURE'
    if report['result'] != expected or not lifecycle.get('cleanup_complete'):
        raise RuntimeError('Unexpected build result or incomplete cleanup')
    if scenario != 'pass':
        phase = 'validate' if scenario == 'invalid-tag' else 'smoke'
        failures = [c for c in lifecycle.get('checks', [])
                    if c['phase'] == phase and not c['ok']]
        expected_error = '40-character commit SHA' if scenario == 'invalid-tag' else '404'
        if not failures or expected_error not in failures[0].get('error', ''):
            raise RuntimeError('Build failed for a different reason than the demo expects')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('scenario', choices=('pass', 'invalid-tag', 'bad-smoke'))
    args = parser.parse_args()
    # Always reset scenario parameters, including after a previous failed demo.
    os.environ.update(SMOKE_PATH='/api/tags', SMOKE_TIMEOUT_SECONDS='120')
    if args.scenario == 'invalid-tag':
        os.environ['IMAGE_TAG'] = 'latest'
    elif args.scenario == 'bad-smoke':
        os.environ.update(SMOKE_PATH='/api/person-e-deliberately-missing', SMOKE_TIMEOUT_SECONDS='30')
    client.REPORT = Path('test-reports/demo') / args.scenario / 'jenkins-result.json'
    client_error = None
    try:
        client.main()
    except RuntimeError as exc:
        client_error = str(exc)
    if not client.REPORT.exists():
        raise RuntimeError(client_error or 'No completed build report was produced')
    report = json.loads(client.REPORT.read_text(encoding='utf-8'))
    authorization = client.auth_header(client.required('JENKINS_USER'), client.required('JENKINS_TOKEN'))
    lifecycle = client.get_json(report['build_url'].rstrip('/') +
        '/artifact/test-reports/logs/integration-summary.json', authorization)
    verify_result(args.scenario, report, lifecycle)
    print('DEMO VERIFIED: {} -> {} (cleanup complete)'.format(args.scenario, report['result']))
    print('Evidence: {}'.format(client.REPORT))


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as exc:
        print('DEMO FAILED: {}'.format(exc), file=sys.stderr)
        sys.exit(1)
