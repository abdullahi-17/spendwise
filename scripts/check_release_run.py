"""Reject rollback sources that were not successful main-branch releases."""
import json
import sys


def validate(run):
    if (run.get('conclusion') != 'success'
            or run.get('head_branch') != 'main'
            or run.get('event') not in ('push', 'workflow_dispatch')
            or run.get('path') != '.github/workflows/deploy.yml'):
        raise ValueError('Choose a successful main-branch Deploy SpendWise run')


if __name__ == '__main__':
    with open(sys.argv[1]) as source:
        validate(json.load(source))
