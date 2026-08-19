"""
Build-time preprocessing: turns data/source/full_data.parquet + the raw
minimap images into the static JSON/JPG assets the React app fetches at
runtime (public/data/*.json, public/minimaps/*.jpg).

Run once from the repo root:
    pip install pyarrow pandas pillow --break-system-packages   # if needed
    python3 scripts/preprocess.py

The repo already ships with the generated output committed under public/,
so running this is only necessary if the source data changes.

Note on full_data.parquet: the raw dataset (see data/source/SOURCE_DATA_README.md)
ships as 1,243 individual per-player-per-match files. full_data.parquet is those
same rows concatenated into one file with two convenience columns added
(`day`, derived from the folder name, and `is_bot`, derived from whether
user_id parses as a UUID) -- no values are altered.
"""
import json
import os

import pandas as pd
import pyarrow.parquet as pq
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'data', 'source')
PUBLIC = os.path.join(ROOT, 'public')

EVENT_CODE = {
    'Kill': 'kill', 'BotKill': 'kill',
    'Killed': 'death', 'BotKilled': 'death',
    'KilledByStorm': 'storm_death',
    'Loot': 'loot',
}

# scale / origin come from the source README's documented coordinate system
# (world units -> normalized 0..1 map space). width/height are filled in
# below once each minimap has been resized, since the source images are NOT
# the 1024x1024 the README describes -- see ARCHITECTURE.md.
MAP_CONFIG = {
    'AmbroseValley': {'scale': 900, 'originX': -370, 'originZ': -473},
    'GrandRift':     {'scale': 581, 'originX': -290, 'originZ': -290},
    'Lockdown':      {'scale': 1000, 'originX': -500, 'originZ': -500},
}

MINIMAP_TARGETS = {
    'AmbroseValley_Minimap.png': ('AmbroseValley', 1600),
    'GrandRift_Minimap.png': ('GrandRift', 1400),
    'Lockdown_Minimap.jpg': ('Lockdown', 1600),
}


def resize_minimaps():
    out_dir = os.path.join(PUBLIC, 'minimaps')
    os.makedirs(out_dir, exist_ok=True)
    dims = {}
    for fname, (map_name, target_w) in MINIMAP_TARGETS.items():
        img = Image.open(os.path.join(SOURCE, 'minimaps', fname)).convert('RGB')
        w, h = img.size
        scale = target_w / w
        new_size = (target_w, round(h * scale))
        img.resize(new_size, Image.LANCZOS).save(
            os.path.join(out_dir, f'{map_name}.jpg'), 'JPEG', quality=87
        )
        dims[map_name] = new_size
        print(f'  {map_name}: {w}x{h} -> {new_size[0]}x{new_size[1]}')
    return dims


def build_data_bundles(dims):
    df = pq.read_table(os.path.join(SOURCE, 'full_data.parquet')).to_pandas()
    if df['event'].dtype == object:
        df['event'] = df['event'].apply(lambda x: x.decode('utf-8') if isinstance(x, bytes) else x)

    out_dir = os.path.join(PUBLIC, 'data')
    os.makedirs(out_dir, exist_ok=True)

    manifest_matches = []

    for map_name, sub in df.groupby('map_id'):
        map_bundle = {'matches': {}}
        for match_id, msub in sub.groupby('match_id'):
            msub = msub.sort_values('ts')
            start_ts = int(msub['ts'].astype('int64').min())
            end_ts = int(msub['ts'].astype('int64').max())
            day = msub['day'].iloc[0]

            players = {}
            kills = deaths = storms = loots = 0
            humans, bots = set(), set()

            for user_id, usub in msub.groupby('user_id'):
                is_bot = bool(usub['is_bot'].iloc[0])
                pts, evts = [], []
                for _, row in usub.iterrows():
                    t = int(row['ts'].value // 1_000_000) - start_ts
                    ev = row['event']
                    x, z = round(float(row['x']), 2), round(float(row['z']), 2)
                    if ev in ('Position', 'BotPosition'):
                        pts.append([t, x, z])
                    else:
                        code = EVENT_CODE.get(ev)
                        if code:
                            evts.append([t, x, z, code])
                            if code == 'kill': kills += 1
                            elif code == 'death': deaths += 1
                            elif code == 'storm_death': storms += 1
                            elif code == 'loot': loots += 1
                players[user_id] = {'bot': is_bot, 'pts': pts, 'evts': evts}
                (bots if is_bot else humans).add(user_id)

            map_bundle['matches'][match_id] = {
                'day': day, 'startTs': 0, 'endTs': end_ts - start_ts, 'players': players,
            }
            manifest_matches.append({
                'id': match_id, 'map': map_name, 'day': day,
                'humans': len(humans), 'bots': len(bots),
                'kills': kills, 'deaths': deaths, 'storms': storms, 'loots': loots,
                'duration': end_ts - start_ts,
            })

        with open(os.path.join(out_dir, f'{map_name}.json'), 'w') as f:
            json.dump(map_bundle, f, separators=(',', ':'))
        size_kb = os.path.getsize(os.path.join(out_dir, f'{map_name}.json')) / 1024
        print(f'  {map_name}: {len(map_bundle["matches"])} matches, {size_kb:.1f} KB')

    for map_name, cfg in MAP_CONFIG.items():
        w, h = dims[map_name]
        cfg['width'], cfg['height'] = w, h
        cfg['image'] = f'/minimaps/{map_name}.jpg'
        cfg['dataFile'] = f'/data/{map_name}.json'

    manifest = {'maps': MAP_CONFIG, 'matches': manifest_matches}
    with open(os.path.join(out_dir, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, separators=(',', ':'))
    print(f'  manifest.json: {os.path.getsize(os.path.join(out_dir, "manifest.json"))/1024:.1f} KB, {len(manifest_matches)} matches')


if __name__ == '__main__':
    print('Resizing minimaps...')
    dims = resize_minimaps()
    print('Building data bundles...')
    build_data_bundles(dims)
    print('Done.')
