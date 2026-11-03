#!/usr/bin/env python3
"""Metadata-only lifecycle audit. Never store prompts or credentials."""
from datetime import datetime, timezone
import json
from pathlib import Path
import sys


def main():
    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            return
        root = Path(__file__).resolve().parents[2]
        target = root
        for component in ['production', 'session-logs']:
            target = target / component
            if target.is_symlink():
                return
            target.mkdir(exist_ok=True)
        file = target / 'agent-audit.jsonl'
        if file.is_symlink():
            return
        record = {'time': datetime.now(timezone.utc).isoformat()}
        for key in ['session_id', 'hook_event_name', 'agent_id', 'agent_type']:
            if isinstance(payload.get(key), str):
                record[key] = payload[key][:256]
        with file.open('a') as output:
            output.write(json.dumps(record, ensure_ascii=False) + '\n')
    except (ValueError, OSError):
        return


if __name__ == '__main__':
    main()
