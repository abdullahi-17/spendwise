"""Check release provenance and live-byte comparison without cloud credentials."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import io

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'scripts/{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DeliveryTests(unittest.TestCase):
    def test_rollback_only_accepts_successful_main_deploys(self):
        check = load('check_release_run').validate
        valid = dict(conclusion='success', head_branch='main', event='push',
                     path='.github/workflows/deploy.yml', head_sha='a' * 40)
        check(valid)
        for key, value in [('conclusion', 'failure'), ('head_branch', 'other'),
                           ('event', 'pull_request'), ('path', 'other.yml')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                check({**valid, key: value})

    def test_missing_or_empty_site_cannot_pass_live_verification(self):
        module = load('check_live')
        with tempfile.TemporaryDirectory() as directory:
            for site in [Path(directory), Path(directory) / 'missing']:
                with self.subTest(site=site), self.assertRaises(ValueError):
                    module.check(site, 'https://example.com')

    def test_live_comparison_checks_bytes_not_just_http_status(self):
        module = load('check_live')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'demo.html').write_bytes(b'demo')
            with patch.object(module, 'urlopen', return_value=io.BytesIO(b'demo')):
                module.check(root, 'https://example.com')
            with patch.object(module, 'urlopen', return_value=io.BytesIO(b'old')):
                with self.assertRaises(ValueError):
                    module.check(root, 'https://example.com')


if __name__ == '__main__':
    unittest.main()
