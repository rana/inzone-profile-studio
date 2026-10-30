"""Import shareable palette assignments, never local native exports or notes."""
from pathlib import Path
import argparse,hashlib,json,re

parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,required=True,help='Existing local Profile-Library directory')
args=parser.parse_args()
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/data';(OUT/'palettes').mkdir(parents=True,exist_ok=True)
source=json.loads((args.source/'profiles.json').read_text())
layout=json.loads((args.source/'tools/key-layout.json').read_text())
ids={k['id'] for k in layout['keys']}
assert len(ids)==81
summaries={
 'amber-hinge-rose':('keeper','Green writing, amber Win/Fn and rose Shift keys.','Preferred after physical comparison.',['Green writing','Amber accents','Rose Shift']),
 'amber-hinge':('accepted','Green writing with an amber Win/Fn pair.','Physically accepted as a simpler alternative.',['Green writing','Amber accents']),
 'jade-exchange':('accepted','Green writing, mint landmarks, azure navigation and a violet frame.','An established physical reference.',['Green writing','Violet frame']),
 'rose-shift':('accepted','A green field with a mirrored rose Shift pair.','Perceptible and liked, but very subtle in the physical trial.',['Green writing','Rose Shift']),
 'moonlit-jade':('experiment','Aqua-jade writing with citron numbers and brackets.','Retained as an experiment; green writing was preferred for daily use.',['Aqua writing','Citron landmarks']),
 'orchid-gates':('reference','Pink-orchid Tab and Enter in the familiar violet frame.','The added distinction was barely perceptible in the physical trial.',['Green writing','Orchid gates']),
 'paired-amber-contrast':('accepted','Green writing with orange Ctrl and yellow Alt in an amber frame.','The wider orange/yellow distinction was visible in the daylight trial.',['Green writing','Warm frame']),
 'azure-exchange':('accepted','Azure writing and green arrows beneath a warm function row.','Readable and harmonious in the trial; green writing was later preferred.',['Azure writing','Violet frame']),
 'orchid-merge':('reference','Green writing, violet command keys and an orchid function-row crown.','Retained reference; the frame and crown felt too similar.',['Green writing','Orchid crown']),
}
records=[];provenance=[]
for p in source['profiles']:
 id=p['id'];assert re.fullmatch(r'[a-z0-9-]+',id)
 if id not in summaries:continue
 original=args.source/p['candidate'];raw=json.loads(original.read_text())
 colors=raw['key_colors'];assert set(colors)==ids
 assert all(re.fullmatch(r'#[0-9A-F]{6}',v) and v!='#000000' for v in colors.values())
 status,summary,acceptance,tags=summaries[id]
 candidate=dict(schema='inzone-lighting-candidate/v1',id=id,name=p['name'],
     brightness_percent=100,brightness_level=10,key_colors=colors,
     device='Sony INZONE KBD-H75 / KBDG900B',layout='US 81-key',
     use=summary,installation_status='Palette design; prepare using your own fresh source-slot native export.')
 target=OUT/'palettes'/(id+'.json');target.write_text(json.dumps(candidate,indent=2)+'\n')
 records.append(dict(id=id,name=p['name'],summary=summary,status=status,
     acceptance=acceptance,tell=p.get('tell',summary),parentId=p.get('parent_id'),
     palette='data/palettes/'+id+'.json',tags=tags))
 provenance.append(dict(id=id,source_palette_sha256=hashlib.sha256(original.read_bytes()).hexdigest(),
     published_palette_sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
     physical_colors_preserved=True,publication_scope='RGB palette and generic design description only'))
catalog=dict(schema='inzone-studio-catalog/v1',title='INZONE Profile Studio',
    defaultProfileId='amber-hinge-rose',profiles=records,
    slots=[dict(slot=1,profileId='amber-hinge-rose',tell='Amber Win/Fn and rose Shifts'),
           dict(slot=2,profileId='rose-shift',tell='Rose Shifts'),
           dict(slot=3,profileId='amber-hinge',tell='Amber Win/Fn'),
           dict(slot=4,profileId='moonlit-jade',tell='Aqua writing and citron numbers')],
    verifiedAt='2026-10-30',setupLabel='Example four-slot setup; not a connected device',
    compatibility='Sony INZONE KBD-H75 US81; native preparation supports the inspected Web export version1.2.1.0 only.')
(OUT/'catalog.json').write_text(json.dumps(catalog,indent=2)+'\n')
# Keep only physical geometry and printable legends, not personal environment paths.
(OUT/'layout.json').write_text(json.dumps({'keys':[{k:v for k,v in key.items() if k in {'id','label','x','y','w'}} for key in layout['keys']]},indent=2)+'\n')
(OUT/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(f'Imported {len(records)} shareable palettes and {len(ids)} physical keys; no native exports or personal notes copied.')
