#!/usr/bin/env python3
"""Small, dependency-free terminal status display for the software template."""
import json
from pathlib import Path
import re
import sys


def scalar(text, section, key):
    block = re.search(r'^' + re.escape(section) + r':\s*\n((?:[ \t]+.*\n?)*)', text, re.M)
    if not block:
        return None
    found = re.search(r'^[ \t]+' + re.escape(key) + r':[ \t]*([^\n#]+)', block.group(1), re.M)
    return found.group(1).strip().strip('"\'') if found else None


def main():
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        payload = {}
    workspace = payload.get('workspace') or {}
    root = Path(workspace.get('project_dir') or Path(__file__).resolve().parent.parent)
    try:
        config = (root / 'project.yaml').read_text()
    except OSError:
        config = ''
    stage = scalar(config, 'project', 'stage') or 'A definir'
    rigor = scalar(config, 'modes', 'rigor') or 'A definir'
    context = (payload.get('context_window') or {}).get('used_percentage')
    model = (payload.get('model') or {}).get('display_name') or 'Modelo não informado'
    stories = list((root / 'production/epics').glob('*/story-*.md'))
    done = 0
    for file in stories:
        try:
            status = re.search(r'^status:[ \t]*([^\n]+)', file.read_text(), re.M)
            if status and status.group(1).strip().strip('"\'').lower() in ('done', 'complete', 'completed'):
                done += 1
        except OSError:
            continue
    parts = [f"ctx: {context}%" if isinstance(context, (float, int)) else 'ctx: --', model, f'{stage} · {rigor}']
    if stories:
        parts.append(f'Histórias {done}/{len(stories)}')
    try:
        state = (root / 'production/state.yaml').read_text()
        active = []
        for key in ['activeEpic', 'activeStory', 'task']:
            found = re.search(r'^' + key + r':[ \t]*([^\n]+)', state, re.M)
            value = found.group(1).strip().strip('"\'') if found else None
            if value and value.lower() not in ('null', '~'):
                active.append(value)
        if active:
            parts.append(' > '.join(active))
    except OSError:
        pass
    print(' | '.join(parts), end='')


if __name__ == '__main__':
    main()
