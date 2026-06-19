"""Local port of drop_seed_warehouse.ipynb — emit the identity-spine seed as SQL.

The notebook seeds a Snowflake warehouse via Snowpark UDTFs. The generators are
pure stdlib and deterministic (seeded by aa_id), so we reproduce the exact same
data here without Snowflake and write a snowflake.sql-style dump (CREATE + INSERT
for all spine tables + DROP.drop_batch), mirroring data/snowflake.sql.

With --csv it also writes a flattened app personal.csv from the SAME generation,
so the Next.js app hashes the exact identifier values the warehouse holds — the
only way download records match Snowflake (the app's own TS RNG never lines up
with the notebook's Python RNG). EMAIL/PHONE/MAID and NDZ (name+dob+zip) match;
VIN/CTVID are synthesized (no warehouse equivalent) and do not.

Run:  python scripts/drop_seed_warehouse.py [--scale 0.000001]
        [--out data/spine_seed.sql] [--csv data/personal.csv]
"""

import argparse
import csv
import random
import uuid

# Valid VIN chars — spec excludes I, O, Q. (Synthesized for the flat CSV only.)
VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"

# --- Parameters (notebook §1) ----------------------------------------------
DATABASE = "FIDES_DEMO"
SPINE = f"{DATABASE}.SPINE"
DROP_SC = f'{DATABASE}."DROP"'
EMAIL_MEAN, PHONE_MEAN, MAID_MEAN = 2, 3, 15


# --- Seed UDTF handlers (notebook §4 — copied verbatim) --------------------
class IdentityGen:
    """Per-person identifier stream: PII, DOB (75%), and randomized EMAIL/PHONE/MAID fan-out."""
    FIRST = ["James", "Mary", "Anne Marie", "José", "Quang", "Sophia", "Liam", "Ava"]
    LAST = ["Smith", "Garcia", "Trần", "Smith Jr", "Harris", "O'Brien", "Johnson", "Parker"]
    SHARED = ["family@shared.com", "info@shared.com", "household@shared.com"]
    JUNK = ["test@test.com", "noreply@example.com"]
    DEV = ["aaid", "idfa"]

    def _uuid(self, rng):
        return str(uuid.UUID(int=rng.getrandbits(128))).lower()

    def _dob(self, rng):
        y, m, d, f = rng.randint(1925, 2010), rng.randint(1, 12), rng.randint(1, 28), rng.randint(1, 4)
        if f == 1: return f"{y:04d}{m:02d}{d:02d}"          # YYYYMMDD
        if f == 2: return f"{m:02d}/{d:02d}/{y:04d}"        # MM/DD/YYYY
        if f == 3: return f"{d:02d}-{m:02d}-{y:04d}"        # DD-MM-YYYY
        return f"{y:04d}-{m:02d}-{d:02d}"                   # ISO

    def _email(self, rng, aa, i):
        r = rng.randint(0, 999)
        if r < 5: return rng.choice(self.SHARED)            # ~0.5% shared (trips guard)
        if r < 7: return rng.choice(self.JUNK)              # ~0.2% junk
        return f"user{aa}_{i}@example{rng.randint(1, 9)}.com"

    def process(self, email_mean, phone_mean, maid_mean, seed):
        rng = random.Random(seed)
        yield ("PII", rng.choice(self.FIRST), rng.choice(self.LAST), f"{rng.randint(1, 99950):05d}", None)
        if rng.random() < 0.75:
            yield ("DOB", self._dob(rng), None, None, None)
        for i in range(rng.randint(0, 2 * email_mean)):
            yield ("EMAIL", self._email(rng, seed, i), None, None, rng.randint(1, 6))
        for _ in range(rng.randint(0, 2 * phone_mean)):
            yield ("PHONE", str(rng.randint(2000000000, 9999999999)), None, None, None)
        for _ in range(rng.randint(0, 2 * maid_mean)):
            yield ("MAID", self._uuid(rng), rng.choice(self.DEV), None, None)


class CtvGen:
    """One CTV row; aa_id NULL ~86% of the time (household / unresolved)."""
    IFA = ["rida", "ifa", "lgid", "aaid"]

    def process(self, n_persons, seed):
        rng = random.Random(seed)
        aa = "" if rng.randint(0, 99) < 86 else str(rng.randint(1, max(1, n_persons)))
        yield ("CTV", str(uuid.UUID(int=rng.getrandbits(128))).lower(), rng.choice(self.IFA), aa, None)


# --- DDL — the notebook assumes these pre-exist; we materialize them --------
DDL = f"""\
create or replace TABLE {SPINE}.INT_AUDIENCE_ACUITY_PII (
\taa_id NUMBER,
\tfirst_name VARCHAR(16777216),
\tlast_name VARCHAR(16777216),
\tzip VARCHAR(16777216)
);

create or replace TABLE {SPINE}.INT_AUDIENCE_ACUITY_DEMOGRAPHIC (
\taa_id NUMBER,
\tbirth_date VARCHAR(16777216)
);

create or replace TABLE {SPINE}.INT_AUDIENCE_ACUITY_EMAIL (
\taa_id NUMBER,
\temail VARCHAR(16777216),
\trank_order NUMBER
);

create or replace TABLE {SPINE}.INT_AUDIENCE_ACUITY_PHONE (
\taa_id NUMBER,
\tphone VARCHAR(16777216)
);

create or replace TABLE {SPINE}.INT_AUDIENCE_ACUITY_MAIDS (
\taa_id NUMBER,
\tdevice_id VARCHAR(16777216),
\tdevice_type VARCHAR(16777216)
);

create or replace TABLE {SPINE}.INT_AUDIENCE_ACUITY_CTV (
\taa_id NUMBER,
\tifa VARCHAR(16777216),
\tifa_type VARCHAR(16777216)
);

create or replace TABLE {SPINE}.INT_SPINE_ID_MAP (
\tspine_id VARCHAR(16777216),
\tsource VARCHAR(16777216),
\tsource_id VARCHAR(16777216),
\tid_type VARCHAR(16777216)
);

create or replace TABLE {DROP_SC}.DROP_BATCH (
\tdrop_id VARCHAR(16777216),
\tdrop_type VARCHAR(16777216),
\thash VARCHAR(16777216)
);
"""


def lit(v):
    """Render a Python value as a SQL literal (Snowflake doubles single quotes)."""
    if v is None or v == "":
        return "NULL"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def insert(out, table, columns, rows, chunk=1000):
    """Emit chunked multi-row INSERTs, or nothing when there are no rows."""
    if not rows:
        return
    cols = ",".join(columns)
    for start in range(0, len(rows), chunk):
        batch = rows[start:start + chunk]
        out.append(f"INSERT INTO {table} ({cols})\nVALUES")
        out.append(",\n".join("(" + ",".join(lit(c) for c in r) + ")" for r in batch) + ";")


# --- Flattened app personal.csv (one row per person) -----------------------
# Identifiers with no warehouse source; deterministic int seeds (never tuple/str
# seeds — str hashing is PYTHONHASHSEED-randomized and would break reproducibility).
def _vin(aa_id):
    rng = random.Random(aa_id + 2_000_000_000)
    return "".join(rng.choice(VIN_CHARS) for _ in range(12)) + f"{aa_id:05d}"


def _ctvid(aa_id):
    rng = random.Random(aa_id + 3_000_000_000)
    return f"ctv_{aa_id:04x}_{rng.randint(1000, 9999)}"


def _row_id(aa_id):
    return str(uuid.UUID(int=random.Random(aa_id + 4_000_000_000).getrandbits(128)))


CSV_HEADER = ["Id", "first", "last", "dob", "zip", "email", "phone", "maid", "vin", "ctvid"]


def write_personal_csv(path, persons):
    """Flatten warehouse persons into the app's one-row-per-persona schema.

    Only fully-matchable people (dob + ≥1 email/phone/maid) are emitted, so every
    row matches NDZ/EMAIL/PHONE/MAID in the warehouse. The golden identity is
    appended (matches EMAIL + NDZ only — the warehouse gives it no phone/maid).
    """
    rows = []
    for aa_id, rec in persons.items():
        if not (rec["dob"] and rec["emails"] and rec["phones"] and rec["maids"]):
            continue
        rows.append([
            _row_id(aa_id), rec["first"], rec["last"], rec["dob"], rec["zip"],
            rec["emails"][0], rec["phones"][0], rec["maids"][0],
            _vin(aa_id), _ctvid(aa_id),
        ])
    rows.append([
        _row_id(900000001), "Danielle", "Johnson", "1985-07-04", "91790",
        "danielle.johnson@example.com", "", "", "", "",
    ])
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(CSV_HEADER)
        w.writerows(rows)
    return len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=float, default=0.000001,
                    help="1.0 == full documented volume (~38B rows). Notebook default 1e-6.")
    ap.add_argument("--out", default="data/spine_seed.sql")
    ap.add_argument("--csv", default=None,
                    help="also write a flattened app personal.csv at this path")
    args = ap.parse_args()

    n_ind = max(1, int(480_000_000 * args.scale))
    n_ctv = max(1, int(29_000_000_000 * args.scale))

    ident = IdentityGen()
    pii, demo, email, phone, maids = [], [], [], [], []
    persons = {}  # aa_id -> flattened record for the CSV

    # gen_identity: one pass per person, aa_id = SEQ8()+1 (1..n_ind), routed by kind.
    for aa_id in range(1, n_ind + 1):
        rec = {"first": "", "last": "", "zip": "", "dob": "", "emails": [], "phones": [], "maids": []}
        for kind, v1, v2, v3, rnk in ident.process(EMAIL_MEAN, PHONE_MEAN, MAID_MEAN, aa_id):
            if kind == "PII":
                rec["first"], rec["last"], rec["zip"] = v1, v2, v3
                pii.append((aa_id, v1, v2, v3))
            elif kind == "DOB":
                rec["dob"] = v1
                demo.append((aa_id, v1))
            elif kind == "EMAIL":
                rec["emails"].append(v1)
                email.append((aa_id, v1, rnk))
            elif kind == "PHONE":
                rec["phones"].append(v1)
                phone.append((aa_id, v1))
            elif kind == "MAID":
                rec["maids"].append(v1)
                maids.append((aa_id, v1, v2))
        persons[aa_id] = rec

    # spine_id_map derived from pii (notebook §5).
    spine = [(f"aa:{aa_id:012d}", "audience_acuity", str(aa_id), "hem") for aa_id, *_ in pii]

    # gen_ctv: independent driver, ctv seed = SEQ8() (0..n_ctv-1), ~86% null aa_id.
    ctv_gen = CtvGen()
    ctv = []
    for seed in range(n_ctv):
        for _kind, v1, v2, v3, _rnk in ctv_gen.process(n_ind, seed):
            ctv.append((int(v3) if v3 != "" else None, v1, v2))

    # Golden identity (notebook §5 — known DROP hashes for downstream validation).
    pii.append((900000001, "Danielle", "Johnson", "91790"))
    demo.append((900000001, "1985-07-04"))
    email.append((900000001, "danielle.johnson@example.com", 1))
    spine.append(("aa:000900000001", "audience_acuity", "900000001", "hem"))
    drop_batch = [
        ("golden_ndz", "NDZ", "PQOfn1RffEKmqMmNAzDKKaoZCwxWbQZkQzPWmQo9REA="),
        ("golden_email", "EMAIL", "Ll3Lj3rfxINestTMkKb13MeSNKMFMNnr98iaWgGtox8="),
    ]

    out = [
        "-- Generated by scripts/drop_seed_warehouse.py — local port of drop_seed_warehouse.ipynb",
        f"-- scale={args.scale}  persons={n_ind}  ctv={n_ctv}",
        "",
        DDL,
    ]
    insert(out, f"{SPINE}.INT_AUDIENCE_ACUITY_PII", ("aa_id", "first_name", "last_name", "zip"), pii)
    insert(out, f"{SPINE}.INT_AUDIENCE_ACUITY_DEMOGRAPHIC", ("aa_id", "birth_date"), demo)
    insert(out, f"{SPINE}.INT_AUDIENCE_ACUITY_EMAIL", ("aa_id", "email", "rank_order"), email)
    insert(out, f"{SPINE}.INT_AUDIENCE_ACUITY_PHONE", ("aa_id", "phone"), phone)
    insert(out, f"{SPINE}.INT_AUDIENCE_ACUITY_MAIDS", ("aa_id", "device_id", "device_type"), maids)
    insert(out, f"{SPINE}.INT_AUDIENCE_ACUITY_CTV", ("aa_id", "ifa", "ifa_type"), ctv)
    insert(out, f"{SPINE}.INT_SPINE_ID_MAP", ("spine_id", "source", "source_id", "id_type"), spine)
    insert(out, f"{DROP_SC}.DROP_BATCH", ("drop_id", "drop_type", "hash"), drop_batch)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")

    csv_rows = write_personal_csv(args.csv, persons) if args.csv else None

    # Verify — row counts + distribution sanity (notebook §6).
    print(f"wrote {args.out}")
    if args.csv:
        print(f"wrote {args.csv} ({csv_rows} rows: {csv_rows - 1} matchable + 1 golden)")
    print(f"  scale={args.scale}  persons={n_ind}  ctv={n_ctv}")
    counts = {
        "pii": len(pii), "demographic": len(demo), "email": len(email),
        "phone": len(phone), "maids": len(maids), "ctv": len(ctv),
        "spine_id_map": len(spine), "drop_batch": len(drop_batch),
    }
    for name, n in counts.items():
        print(f"  {name:<14} {n:,}")
    persons = len(pii)
    ctv_null = sum(1 for r in ctv if r[0] is None)
    print("distribution (expect ~2 / ~15 / ~0.75 / ~0.86):")
    print(f"  emails/person: {len(email) / persons:.2f}")
    print(f"  maids/person : {len(maids) / persons:.2f}")
    print(f"  dob coverage : {len(demo) / persons:.2f}")
    print(f"  ctv null frac: {ctv_null / len(ctv):.2f}")


if __name__ == "__main__":
    main()
