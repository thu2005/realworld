"""Check that the demo cannot accept an unrelated Jenkins failure."""
import unittest
from pathlib import Path
import tempfile
from unittest.mock import patch

from demo import verify_result
import trigger_jenkins as client


class DemoVerdictTests(unittest.TestCase):
    def test_failed_request_cannot_reuse_previous_success_report(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / 'jenkins-result.json'
            report.write_text('{"result":"SUCCESS"}')
            environment = {'JENKINS_URL':'http://localhost:18080', 'JENKINS_USER':'test-user',
                'JENKINS_TOKEN':'fake-for-test', 'IMAGE_REPO':'ghcr.io/thu2005/realworld',
                'IMAGE_TAG':'a' * 40, 'SUT_REPO_URL':'https://github.com/thu2005/realworld.git',
                'SUT_REF':'next'}
            with patch.object(client, 'REPORT', report), patch.dict('os.environ', environment, clear=True), \
                    patch.object(client, 'request', side_effect=RuntimeError('Cannot reach Jenkins')):
                with self.assertRaises(RuntimeError):
                    client.main()
            self.assertFalse(report.exists())

    def test_success_requires_cleanup(self):
        with self.assertRaises(RuntimeError):
            verify_result('pass', {'result': 'SUCCESS'}, {'cleanup_complete': False})

    def test_invalid_tag_accepts_only_validation_failure(self):
        state = {'cleanup_complete': True, 'checks': [
            {'phase': 'validate', 'ok': False, 'error': 'Expected 40-character commit SHA'}]}
        verify_result('invalid-tag', {'result': 'FAILURE'}, state)

    def test_unrelated_failure_is_rejected(self):
        state = {'cleanup_complete': True, 'checks': [
            {'phase': 'pull', 'ok': False, 'error': 'Cannot reach registry'}]}
        with self.assertRaises(RuntimeError):
            verify_result('invalid-tag', {'result': 'FAILURE'}, state)

    def test_smoke_connection_failure_is_not_the_expected_404(self):
        state = {'cleanup_complete': True, 'checks': [
            {'phase': 'smoke', 'ok': False, 'error': 'ECONNREFUSED'}]}
        with self.assertRaises(RuntimeError):
            verify_result('bad-smoke', {'result': 'FAILURE'}, state)

    def test_expected_404_is_accepted(self):
        state = {'cleanup_complete': True, 'checks': [
            {'phase': 'smoke', 'ok': False, 'error': 'HTTP 404'}]}
        verify_result('bad-smoke', {'result': 'FAILURE'}, state)


if __name__ == '__main__':
    unittest.main()
