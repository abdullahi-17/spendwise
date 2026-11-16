"""Release integrity and path boundary checks; no AWS access required."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('release', ROOT / 'scripts/release.py')
        self.release = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.release)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.site = self.root / 'site'
        self.site.mkdir()
        (self.site / 'demo.html').write_text('<h1>Demo</h1>')

    def test_package_and_verify_then_detect_changed_file(self):
        dest = self.root / 'artifact'
        self.release.package(self.site, dest, 'a' * 40)
        self.release.verify(dest)
        (dest / 'site/demo.html').write_text('changed')
        with self.assertRaises(ValueError):
            self.release.verify(dest)

    def test_extra_file_is_rejected(self):
        dest = self.root / 'artifact'
        self.release.package(self.site, dest, 'b' * 40)
        (dest / 'site/extra.html').write_text('unexpected')
        with self.assertRaises(ValueError):
            self.release.verify(dest)

    def test_symlinks_cannot_escape_site(self):
        (self.site / 'outside').symlink_to(ROOT / 'README.md')
        with self.assertRaises(ValueError):
            self.release.package(self.site, self.root / 'artifact', 'c' * 40)

    def test_empty_site_is_rejected(self):
        (self.site / 'demo.html').unlink()
        with self.assertRaises(ValueError):
            self.release.package(self.site, self.root / 'artifact', 'd' * 40)

    def test_package_does_not_overwrite_existing_release(self):
        dest = self.root / 'artifact'
        dest.mkdir()
        with self.assertRaises(FileExistsError):
            self.release.package(self.site, dest, 'e' * 40)


if __name__ == '__main__':
    unittest.main()
