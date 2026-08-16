#!/usr/bin/env python3
import argparse
import json
import os
import urllib.error
import urllib.parse
import urllib.request

PROTECTED = {'main', 'master'}


def api(url, token, method='GET'):
    request = urllib.request.Request(
        url,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'strikeglass-branch-hygiene'
        }
    )
    with urllib.request.urlopen(request) as response:
        body = response.read()
        return json.loads(body) if body else None


def branch_is_fully_merged(repo, branch, token):
    quoted = urllib.parse.quote(branch, safe='')
    comparison = api(f'https://api.github.com/repos/{repo}/compare/{quoted}...main', token) or {}
    # With branch as base and main as head, behind_by > 0 means the branch still
    # owns commits that main does not contain. Only delete a fully-contained head.
    return int(comparison.get('behind_by') or 0) == 0


def delete_merged_branch(repo, branch, token, dry_run=False):
    if not branch or branch in PROTECTED:
        print(f'skip {branch or "<empty>"}: protected branch')
        return False
    try:
        if not branch_is_fully_merged(repo, branch, token):
            print(f'skip {branch}: current head contains commits not present on main')
            return False
    except urllib.error.HTTPError as error:
        if error.code == 404:
            print(f'skip {branch}: ref already absent')
            return False
        raise
    print(f'{"would delete" if dry_run else "delete"} merged branch {branch}')
    if not dry_run:
        encoded = urllib.parse.quote(f'heads/{branch}', safe='/')
        api(f'https://api.github.com/repos/{repo}/git/refs/{encoded}', token, method='DELETE')
    return True


def merged_heads(repo, token):
    page = 1
    seen = set()
    while True:
        pulls = api(f'https://api.github.com/repos/{repo}/pulls?state=closed&per_page=100&page={page}', token) or []
        if not pulls:
            break
        for pull in pulls:
            if pull.get('merged_at') and pull.get('head', {}).get('repo', {}).get('full_name') == repo:
                branch = pull.get('head', {}).get('ref')
                if branch:
                    seen.add(branch)
        if len(pulls) < 100:
            break
        page += 1
    return sorted(seen)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', required=True)
    parser.add_argument('--event-path')
    parser.add_argument('--prune-merged', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if not token:
        raise SystemExit('GITHUB_TOKEN/GH_TOKEN is required')

    if args.event_path and os.path.exists(args.event_path):
        with open(args.event_path, encoding='utf-8') as handle:
            event = json.load(handle)
        pull = event.get('pull_request') or {}
        if pull.get('merged') and pull.get('head', {}).get('repo', {}).get('full_name') == args.repo:
            delete_merged_branch(args.repo, pull.get('head', {}).get('ref', ''), token, args.dry_run)

    if args.prune_merged:
        for branch in merged_heads(args.repo, token):
            try:
                delete_merged_branch(args.repo, branch, token, args.dry_run)
            except urllib.error.HTTPError as error:
                if error.code in {404, 422}:
                    print(f'skip {branch}: ref already absent')
                else:
                    raise


if __name__ == '__main__':
    main()
