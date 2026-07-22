# caldrop (Next.js)

Dev emulator of the **DROP Data Broker API** (California Delete Act),
spec at `/Users/mike/code/fidesplus/drop/openapi.yaml`. Next.js / TypeScript
port of the original FastAPI emulator.

Three API endpoints, `X-API-KEY` header auth. The API keys, broker id, and
defaults are baked in (see `src/lib/config.ts`); the only env var is the
optional `DATABASE_URL` for upload persistence (see below).

Baked-in API keys: `dev-key-123`, `broker-4821-key`. Broker id: `4821`.

## Setup

```bash
npm install
npm run seed   # generate sample data -> data/personal.csv
npm run dev    # launch dev server (default http://localhost:3000)
```

## Endpoints

| Method | Path             | Auth | Returns |
|--------|------------------|------|---------|
| GET    | `/data/download` | yes  | ZIP of hashed consumer CSVs — hashed and streamed on the fly per request |
| POST   | `/data/upload`   | yes  | `UploadResponse` JSON (mode `new`) |
| POST   | `/data/amend`    | yes  | `UploadResponse` JSON (mode `amend`) |
| GET    | `/preview`       | no   | dev-only HTML table of `personal.csv` + derived hashes |
| GET    | `/records`       | no   | HTML view of persisted uploads + current consumer state |

`GET /data/download` accepts an optional `?lists=` query param to select which
CSVs to include, e.g. `?lists=NDZ,EMAIL`. Default: all six list types
(`NDZ,EMAIL,PHONE,MAID,NVIN,CTVID`). An unknown list name → `400`.

Missing/invalid key → `401`.

### Sandbox mode

The three data endpoints are also mounted under a `/sandbox` prefix with
identical behavior:

- `GET  /sandbox/data/download`
- `POST /sandbox/data/upload`
- `POST /sandbox/data/amend`

`/preview` is dev-only and is **not** mirrored under `/sandbox`.

### Edge-case test keys

Beyond the two happy-path keys, `X-API-KEY` also selects opt-in edge-case
behaviors (see `src/lib/testBehaviors.ts`) for exercising client error
handling the happy-path keys can't produce — dev/test only, works on both
`/data/*` and `/sandbox/data/*`:

| Key | Endpoint | Behavior |
|-----|----------|----------|
| `edge-nodata-key` | `GET .../download` | `200` with a `{"message": ...}` JSON body instead of a ZIP (no new data) |
| `edge-batch-incomplete-key` | `GET .../download` | `409` (previous batch not fully uploaded) |
| `edge-building-key` | `GET .../download` | `202` + `Retry-After: 1`, every call (archive never finishes building) |
| `edge-malformed-key` | `GET .../download` | `200` with a non-ZIP body that also isn't a valid `{"message"}` shape |
| `edge-dup-filename-key` | `POST .../upload` | Rejects the first upload of a given filename ("same filename..."); a retry of the *same* filename accepts |
| `edge-reject-key` | `POST .../upload` | Always rejects, even on retry |

## Seed

`src/lib/seed.ts` holds sample consumers with personal info (name, DOB, ZIP,
email, phone, MAID, VIN, CTVID). Seeding writes only the raw records to
`data/personal.csv` — the source of truth, never served directly.

On each `GET /data/download`, `src/lib/archive.ts` reads `personal.csv`,
hashes identifiers per the spec canonicalization + SHA-256/Base64 rules
(concatenated hashing for NDZ and NVIN), and **streams** a ZIP with one CSV
per enabled list — entries carry a fixed timestamp so two downloads are
byte-identical. Each list CSV is limited to two rows: one record that matches
`personal.csv` (a real persona) and one synthetic record absent from the
dataset (Id beyond the seeded range).

Re-run `npm run seed` after editing `PEOPLE` or `.env`.

## Examples

```bash
curl -H "X-API-KEY: dev-key-123" http://localhost:3000/data/download --output download.zip

printf 'Id,Status\n679,2\n680,5\n' > 20260312_4821_Email.csv
curl -H "X-API-KEY: dev-key-123" \
  -F "files=@20260312_4821_Email.csv;type=text/csv" \
  http://localhost:3000/data/upload
```

Valid status codes: `2` exempt, `3` deleted, `4` opted out, `5` not found.

## Persistence (Neon Postgres)

Uploads and amends are recorded to Postgres when `DATABASE_URL` is set. On
Vercel, add the **Neon** integration — it injects `DATABASE_URL` automatically.
Locally, copy `.env.example` to `.env`. With no `DATABASE_URL`, persistence is
silently skipped (the API behaves exactly as before).

Each accepted file writes three things:

- **`uploads`** — one audit row per file (mode, file name, broker id, `sandbox`
  flag, accepted/rejected, message, row count, timestamp). Rejected files are
  logged too.
- **`upload_records`** — one row per parsed `Id,Status` line (full history).
- **`records`** — current status per consumer, keyed by `(consumer_id, sandbox)`.
  `new` inserts, `amend` updates. Upserted on each submission.

Sandbox uploads (`/sandbox/data/*`) persist with `sandbox = true`.

Schema is created lazily on the first write. To provision a fresh database up
front:

```bash
DATABASE_URL=postgres://... npm run db:init
```

Browse what's stored at `GET /records` (HTML).

## Quality checks

```bash
npm test          # full vitest suite (mirrors the original pytest suite)
npm run typecheck # tsc --noEmit
npm run lint      # next lint
```

## Docker

```bash
docker build -t caldrop:dev .
docker run --rm -p 3000:3000 caldrop:dev
```

The image seeds `data/personal.csv` at build time so `/data/download` works immediately.

## Config

Everything except `DATABASE_URL` is baked into `src/lib/config.ts`:

| Setting          | Value                            | Purpose |
|------------------|----------------------------------|---------|
| API keys         | `dev-key-123`, `broker-4821-key` | Valid `X-API-KEY` values |
| Broker id        | `4821`                           | Embedded in download CSV file names |
| File date        | today (`YYYYMMDD`)               | Date in download file names |
| Lists            | `?lists=` query param            | Lists in the archive (default: all six) |
| `DATABASE_URL`   | env var (optional)               | Neon Postgres connection for persistence |
