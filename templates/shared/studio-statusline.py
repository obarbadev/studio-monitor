#!/usr/bin/env python3
"""Mirror public statusline metrics for Studio Monitor, then preserve the user's output.

No prompts, credentials, tool inputs, or full transcripts are persisted.
"""
import datetime
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


def number(value, percentage=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        return None
    return min(100, max(0, value)) if percentage else max(0, value)


def collect(payload, root):
    context = payload.get('context_window') if isinstance(payload.get('context_window'), dict) else {}
    current = context.get('current_usage') if isinstance(context.get('current_usage'), dict) else {}
    model = payload.get('model') if isinstance(payload.get('model'), dict) else {}
    cost = payload.get('cost') if isinstance(payload.get('cost'), dict) else {}
    return {
        'schemaVersion': 1,
        'source': 'studio-statusline',
        'sessionId': payload.get('session_id'),
        'projectPath': str(root),
        'writtenAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'model': {key: str(model.get(field) or '')[:256] for key, field in [('id', 'id'), ('name', 'display_name')]},
        'context': {
            'usedPercentage': number(context.get('used_percentage'), True),
            'windowTokens': number(context.get('context_window_size')),
            'inputTokens': number(context.get('total_input_tokens')),
            'outputTokens': number(context.get('total_output_tokens')),
            'lastInputTokens': sum(number(current.get(key)) or 0 for key in ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) if current else None,
        },
        'cost': {'totalUsd': number(cost.get('total_cost_usd'))},
    }


def save(record, root):
    sid = record.get('sessionId')
    if not isinstance(sid, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', sid):
        return
    directory = root
    for part in ['.studio', 'runtime', 'statusline']:
        directory = directory / part
        if directory.is_symlink():
            return
        directory.mkdir(exist_ok=True)
    target = directory / (sid + '.json')
    if target.is_symlink():
        return
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', dir=directory, prefix='.status-', delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(record, handle, ensure_ascii=False, allow_nan=False)
        os.chmod(temporary, 0o600)
        os.replace(temporary, target)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main():
    raw = sys.stdin.read()
    root = Path(__file__).resolve().parent.parent
    try:
        payload = json.loads(raw)
        if isinstance(payload, dict):
            save(collect(payload, root), root)
    except (ValueError, TypeError, OSError):
        pass  # A monitoring failure must never break the configured statusline.
    args = sys.argv[1:]
    if args and args[0] == '--':
        args = args[1:]
    try:
        status_file = root / '.studio' / 'runtime' / 'project-status.json'
        status = json.loads(status_file.read_text()) if status_file.exists() and status_file.stat().st_size < 16384 else {}
    except (ValueError, OSError):
        status = {}
    try:
        context = (payload.get('context_window') or {}).get('used_percentage')
        model = (payload.get('model') or {}).get('display_name') or status.get('model') or 'Claude Code'
        fresh = isinstance(status.get('updatedAt'), (int, float)) and datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000 - status['updatedAt'] <= 30000
        phase = status.get('phase') if fresh or status.get('phaseSource') == 'manual' else None
        if not phase:
            try:
                current = (root / 'production/session-state/active.md').read_text()[:16000]
                section = re.search(r'(?im)^##\s+(?:Current task|Tarefa atual|Trabalho atual)\s*\n([^\n]+(?:\n(?![-*] |## )[^\n]+)*)', current)
                if section and re.search(r'/design-review|/design-system\s+retrofit|(?:adequa|adapta|retrofit).{0,100}(?:doc|gdd|sdd|template)', section.group(1), re.I):
                    phase = 'Adequação e revisão da documentação'
            except OSError:
                pass
        phase = str(phase or 'Etapa não informada')[:120]
        active = status.get('activeAgents')
        if not isinstance(status.get('updatedAt'), (int, float)) or datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000 - status['updatedAt'] > 30000:
            active = None
        agent_label = f'{active} agentes' if isinstance(active, int) else 'agentes: --'
        print(f'Studio | {model} | ctx: {context}%' if context is not None else f'Studio | {model} | ctx: --', end='')
        print(f' | {phase} | {agent_label}', flush=True)
    except (NameError, AttributeError, TypeError):
        print('Studio | aguardando métricas', flush=True)
    if args:
        try:
            result = subprocess.run(['bash', '-c', args[0]], input=raw, text=True)
            return 0
        except OSError:
            return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
