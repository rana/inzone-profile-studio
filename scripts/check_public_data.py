"""Check the distributable palette set without publishing personal records."""
from pathlib import Path
import hashlib,json,re

ROOT=Path(__file__).resolve().parent.parent
DATA=ROOT/'public/data'
catalog=json.loads((DATA/'catalog.json').read_text())
layout=json.loads((DATA/'layout.json').read_text())
ids={k['id'] for k in layout['keys']}
assert len(ids)==81 and len(layout['keys'])==81
assert len({p['id'] for p in catalog['profiles']})==len(catalog['profiles'])
assert catalog['defaultProfileId'] in {p['id'] for p in catalog['profiles']}
manifest={r['id']:r for r in json.loads((DATA/'provenance.json').read_text())}
for p in catalog['profiles']:
 path=ROOT/'public'/p['palette'];assert path.is_file()
 candidate=json.loads(path.read_text());colors=candidate['key_colors']
 assert set(colors)==ids,(p['id'],'physical layout')
 assert candidate['brightness_percent']==100
 assert all(re.fullmatch(r'#[0-9A-F]{6}',v) and v!='#000000' for v in colors.values())
 for a,b in [('CTRL_L','CTRL_R'),('ALT_L','ALT_R'),('SHIFT_L','SHIFT_R')]:assert colors[a]==colors[b]
 assert hashlib.sha256(path.read_bytes()).hexdigest()==manifest[p['id']]['published_palette_sha256']
for path in (ROOT/'public').rglob('*'):
 assert not path.is_symlink(),'Public assets must not link outside their directory'
 if not path.is_file():continue
 assert path.suffix.lower() not in {'.jpg','.jpeg','.zip','.toml'},('Unexpected public asset',path)
 if path.suffix.lower() in {'.json','.txt','.md','.html','.js','.ts'}:
  text=path.read_text()
  for forbidden in ['/home/rana','libfile_','IMG_0182','KeyAssignSettings','WithFnKeyAssignSettings','GH_TOKEN','github_pat_']:
   assert forbidden not in text,('Private material in public data',path.name,forbidden)
print(f'PASS: {len(catalog["profiles"])} shareable palettes, 81 keys each, pairs, hashes and public data boundary.')
