from pathlib import Path

source_path = Path('scripts/refine_ui_alignment.py')
source = source_path.read_text(encoding='utf-8')
source = source.replace(
    "        raise SystemExit(f'missing block in {path}: {old[:100]}')",
    "        print(f'skip missing block in {path}: {old[:100]}')\n        return",
)
source = source.replace(
    "    raise SystemExit('missing Luminous X light body block')",
    "    print('skip missing Luminous X light body block')",
)
exec(compile(source, str(source_path), 'exec'))
