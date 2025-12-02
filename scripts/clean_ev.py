#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT_CSV = ROOT / "assets" / "seattle_ev_cleaned.csv"
CLEAN_CSV = ROOT / "assets" / "seattle_ev_cleaned_clean.csv"
CLEAN_GEOJSON = ROOT / "assets" / "seattle_ev_cleaned_clean.geojson"


def normalize_header(h: str) -> str:
    h = h.strip()
    h = re.sub(r"\s+", " ", h)
    return h


def key_name(h: str) -> str:
    # create safe property names
    return re.sub(r"[^0-9a-zA-Z_]+", "_", h.strip().lower()).strip("_")


def parse_float(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except Exception:
        return None


def parse_int(v):
    try:
        if v is None or v == "":
            return None
        return int(float(v))
    except Exception:
        return None


def normalize_connectors(s: str):
    if s is None:
        return []
    s = s.strip()
    if s == "":
        return []
    # split on common separators
    parts = re.split(r"[,;/\\]|\s{2,}|\s", s)
    parts = [p.strip().upper() for p in parts if p and p.strip()]
    # common concatenated tokens like J1772COMBO -> keep as-is
    # deduplicate preserving order
    seen = set()
    out = []
    for p in parts:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return out


def main():
    if not INPUT_CSV.exists():
        print(f"Input CSV not found: {INPUT_CSV}")
        return

    with INPUT_CSV.open(newline='', encoding='utf-8') as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)

    if not rows:
        print("No rows in CSV")
        return

    # normalize headers mapping
    original_fields = reader.fieldnames
    field_map = {f: key_name(f) for f in original_fields}

    cleaned = []
    seen = set()
    invalid_coord_count = 0
    dup_count = 0

    for r in rows:
        # trim whitespace
        r = {k: (v.strip() if isinstance(v, str) else v) for k, v in r.items()}

        # get lat/lon
        lat = parse_float(r.get('Latitude') or r.get('latitude') )
        lon = parse_float(r.get('Longitude') or r.get('longitude'))
        if lat is None or lon is None:
            invalid_coord_count += 1
            continue

        # drop obviously invalid coords (outside bounding box for Seattle area)
        if not (47.3 <= lat <= 47.8 and -122.55 <= lon <= -122.15):
            invalid_coord_count += 1
            continue

        name = r.get('Station Name') or r.get('Station name') or ''
        addr = r.get('Street Address') or ''
        key = (name.strip().upper(), addr.strip().upper(), round(lat,6), round(lon,6))
        if key in seen:
            dup_count += 1
            continue
        seen.add(key)

        # numeric conversions
        level1 = parse_int(r.get('EV Level1 EVSE Num') or r.get('EV Level1 EVSE Num'.lower()))
        level2 = parse_int(r.get('EV Level2 EVSE Num') or r.get('EV Level2 EVSE Num'.lower()))
        dc_fast = parse_int(r.get('EV DC Fast Count') or r.get('EV DC Fast Count'.lower()))

        connectors = normalize_connectors(r.get('EV Connector Types') or r.get('EV Connector Types'.lower()))

        # build property dict with normalized keys
        props = {}
        for orig in original_fields:
            k = field_map[orig]
            v = r.get(orig)
            # coerce common fields
            if k in ('latitude','longitude'):
                continue
            if orig in ('EV Level1 EVSE Num', 'EV Level2 EVSE Num', 'EV DC Fast Count'):
                continue
            props[k] = v

        props['latitude'] = lat
        props['longitude'] = lon
        props['ev_level1_evse_num'] = level1 if level1 is not None else 0
        props['ev_level2_evse_num'] = level2 if level2 is not None else 0
        props['ev_dc_fast_count'] = dc_fast if dc_fast is not None else 0
        props['ev_connector_types'] = connectors

        cleaned.append((lat, lon, props))

    # write cleaned CSV
    out_fieldnames = [key_name(f) for f in original_fields if key_name(f) not in ('latitude','longitude')]
    # append our normalized numeric and connector fields (ensures presence)
    extra = ['latitude','longitude','ev_level1_evse_num','ev_level2_evse_num','ev_dc_fast_count','ev_connector_types']
    out_fieldnames = out_fieldnames + [c for c in extra if c not in out_fieldnames]

    with CLEAN_CSV.open('w', newline='', encoding='utf-8') as fh:
        writer = csv.DictWriter(fh, fieldnames=out_fieldnames)
        writer.writeheader()
        for lat, lon, props in cleaned:
            row = {fn: props.get(fn, '') for fn in out_fieldnames}
            # convert connector list to semicolon-separated string for CSV
            row['ev_connector_types'] = ';'.join(props.get('ev_connector_types', []))
            writer.writerow(row)

    # write GeoJSON
    features = []
    for lat, lon, props in cleaned:
        prop_copy = props.copy()
        # remove lat/lon duplicates from properties if present
        prop_copy.pop('latitude', None)
        prop_copy.pop('longitude', None)
        features.append({
            'type': 'Feature',
            'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
            'properties': prop_copy
        })

    fc = {'type': 'FeatureCollection', 'features': features}
    with CLEAN_GEOJSON.open('w', encoding='utf-8') as fh:
        json.dump(fc, fh, ensure_ascii=False, indent=2)

    print(f"Rows input: {len(rows)}")
    print(f"Rows cleaned: {len(cleaned)}")
    print(f"Invalid coords removed: {invalid_coord_count}")
    print(f"Duplicates removed: {dup_count}")
    print(f"Wrote: {CLEAN_CSV}\nWrote: {CLEAN_GEOJSON}")


if __name__ == '__main__':
    main()
