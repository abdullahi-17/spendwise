"""Package static files once; verify the same bytes before deploy or rollback."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def inventory(site):
    files = {}
    for path in sorted(site.rglob('*')):
        if path.is_symlink():
            raise ValueError('Release files cannot be symbolic links')
        if path.is_file():
            files[path.relative_to(site).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    if not files:
        raise ValueError('Release has no website files')
    return files


def package(source, destination, revision):
    source, destination = Path(source), Path(destination)
    if destination.exists():
        raise FileExistsError('Choose a new release destination')
    files = inventory(source)
    if source.resolve() in destination.resolve().parents:
        raise ValueError('Release destination must be outside the source')
    destination.mkdir(parents=True)
    shutil.copytree(source, destination / 'site')
    manifest = {'revision': revision, 'files': files}
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    verify(destination)


def verify(destination):
    destination = Path(destination)
    manifest = json.loads((destination / 'manifest.json').read_text())
    if inventory(destination / 'site') != manifest['files']:
        raise ValueError('Release files do not match the SHA-256 manifest')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    build = commands.add_parser('package')
    build.add_argument('source', type=Path)
    build.add_argument('destination', type=Path)
    build.add_argument('--revision', required=True)
    check = commands.add_parser('verify')
    check.add_argument('destination', type=Path)
    args = parser.parse_args()
    if args.command == 'package':
        package(args.source, args.destination, args.revision)
    else:
        manifest = verify(args.destination)
        print('Verified release:', manifest['revision'])
