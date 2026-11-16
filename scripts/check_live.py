"""Compare public website bytes with the tested release after cache refresh."""
from pathlib import Path
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen


def check(site, origin):
    site = Path(site)
    files = sorted(path for path in site.rglob('*') if path.is_file())
    if not files:
        raise ValueError('Cannot verify a missing or empty website')
    for path in files:
        relative = path.relative_to(site).as_posix()
        request = Request(origin.rstrip('/') + '/' + quote(relative),
                          headers={'Cache-Control': 'no-cache'})
        with urlopen(request, timeout=30) as response:
            if response.read() != path.read_bytes():
                raise ValueError('Public bytes differ: ' + relative)
    print('Public website matches the release')


if __name__ == '__main__':
    check(Path(sys.argv[1]), sys.argv[2])
