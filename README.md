# caldrop (Next.js)

Dev emulator of the **DROP Data Broker API** (California Delete Act),
spec at `/Users/mike/code/fidesplus/drop/openapi.yaml`. Next.js / TypeScript
port of the original FastAPI emulator.

Three API endpoints, `X-API-KEY` header auth. No environment variables —
the API keys, broker id, and defaults are baked in (see `src/lib/config.ts`).

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

## Seed

`src/lib/seed.ts` holds sample consumers with personal info (name, DOB, ZIP,
email, phone, MAID, VIN, CTVID). Seeding writes only the raw records to
`data/personal.csv` — the source of truth, never served directly.

On each `GET /data/download`, `src/lib/archive.ts` reads `personal.csv`,
hashes each identifier per the spec canonicalization + SHA-256/Base64 rules
(concatenated hashing for NDZ and NVIN), and **streams** a ZIP with one CSV
per enabled list — entries carry a fixed timestamp so two downloads are
byte-identical.

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

No env vars. Everything is baked into `src/lib/config.ts`:

| Setting          | Value                            | Purpose |
|------------------|----------------------------------|---------|
| API keys         | `dev-key-123`, `broker-4821-key` | Valid `X-API-KEY` values |
| Broker id        | `4821`                           | Embedded in download CSV file names |
| File date        | today (`YYYYMMDD`)               | Date in download file names |
| Lists            | `?lists=` query param            | Lists in the archive (default: all six) |
