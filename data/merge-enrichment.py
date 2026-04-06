#!/usr/bin/env python3
"""Merge enrichment JSON files into grammar-seed.json, then re-seed the DB."""
import json, glob, os, sys

BASE = '/home/noman/resume/jlpt-dashboard/data'
SEED = os.path.join(BASE, 'grammar-seed.json')

with open(SEED, encoding='utf-8') as f:
    points = json.load(f)

# Build slug index
slug_map = {p['slug']: p for p in points}

# Load all enrichment batch files
enrichment_files = sorted(glob.glob(os.path.join(BASE, 'enrichment-batch-*.json')))
print(f"Found {len(enrichment_files)} enrichment batch files")

total_enriched = 0
for ef in enrichment_files:
    with open(ef, encoding='utf-8') as f:
        batch = json.load(f)
    print(f"  {os.path.basename(ef)}: {len(batch)} entries")
    for slug, data in batch.items():
        if slug not in slug_map:
            print(f"    WARNING: slug '{slug}' not found in seed!")
            continue
        p = slug_map[slug]
        if data.get('explanation'):
            p['explanation'] = data['explanation']
        if data.get('structure'):
            p['structure'] = data['structure']
        if data.get('examples'):
            p['examples'] = data['examples']
        if data.get('meaning'):
            p['meaning'] = data['meaning']
        total_enriched += 1

# Write back
with open(SEED, 'w', encoding='utf-8') as f:
    json.dump(points, f, ensure_ascii=False, indent=2)

# Stats
w_ex = sum(1 for p in points if p.get('examples'))
w_expl = sum(1 for p in points if p['explanation'] != p['meaning'])
print(f"\nTotal enriched this run: {total_enriched}")
print(f"Grammar points with examples: {w_ex}/{len(points)}")
print(f"Grammar points with real explanations: {w_expl}/{len(points)}")
print(f"Written to: {SEED}")
