import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as download } from "@/app/data/download/route";
import { POST as amend } from "@/app/data/amend/route";
import { POST as upload } from "@/app/data/upload/route";
import { config } from "@/lib/config";
import { LIST_TYPES } from "@/lib/lists";
import path from "node:path";
import { authHeaders, csvUpload, seedTemp } from "./helpers";

beforeEach(() => {
  seedTemp();
});

function uploadReq(form: FormData, headers: Record<string, string> = authHeaders()): Request {
  return new Request("http://test/data/upload", { method: "POST", headers, body: form });
}

function downloadReq(
  headers: Record<string, string> = authHeaders(),
  query = "",
): Request {
  return new Request(`http://test/data/download${query}`, { headers });
}

describe("auth", () => {
  it("missing key -> 401", async () => {
    const r = await download(new Request("http://test/data/download"));
    expect(r.status).toBe(401);
  });

  it("invalid key -> 401", async () => {
    const r = await download(downloadReq({ "X-API-KEY": "wrong" }));
    expect(r.status).toBe(401);
    expect((await r.json()).detail).toContain("missing or invalid");
  });

  it("both configured keys work", async () => {
    for (const key of ["dev-key-123", "broker-4821-key"]) {
      const r = await download(downloadReq({ "X-API-KEY": key }));
      expect(r.status).toBe(200);
    }
  });

  it("upload also requires a key", async () => {
    const r = await upload(
      new Request("http://test/data/upload", { method: "POST", body: csvUpload("f.csv", "Id,Status\n1,2\n") }),
    );
    expect(r.status).toBe(401);
  });
});

describe("download", () => {
  it("returns a zip", async () => {
    const r = await download(downloadReq());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
    expect(r.headers.get("content-disposition")).toContain("download.zip");
  });

  it("zip has the expected csvs", async () => {
    const r = await download(downloadReq());
    const names = Object.keys(unzipSync(new Uint8Array(await r.arrayBuffer())));
    expect(names).toContain("20260312_4821_Email.csv");
    expect(names.length).toBe(LIST_TYPES.length);
  });

  it("?lists= selects a subset", async () => {
    const r = await download(downloadReq(authHeaders(), "?lists=EMAIL,PHONE"));
    const names = Object.keys(unzipSync(new Uint8Array(await r.arrayBuffer()))).sort();
    expect(names).toEqual(["20260312_4821_Email.csv", "20260312_4821_Phone.csv"]);
  });

  it("invalid ?lists= -> 400", async () => {
    const r = await download(downloadReq(authHeaders(), "?lists=BOGUS"));
    expect(r.status).toBe(400);
    expect((await r.json()).detail).toContain("Unknown list type");
  });

  it("same file every call", async () => {
    const a = Buffer.from(await (await download(downloadReq())).arrayBuffer());
    const b = Buffer.from(await (await download(downloadReq())).arrayBuffer());
    expect(a.equals(b)).toBe(true);
  });

  it("500 when not seeded", async () => {
    config.personalCsv = path.join(config.dataDir, "missing.csv");
    const r = await download(downloadReq());
    expect(r.status).toBe(500);
    expect((await r.json()).detail.toLowerCase()).toContain("seed");
  });
});

describe("upload", () => {
  it("valid file accepted", async () => {
    const r = await upload(uploadReq(csvUpload("20260312_4821_Email.csv", "Id,Status\n1,2\n2,5\n")));
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.mode).toBe("new");
    expect(body.acceptedCount).toBe(1);
    expect(body.rejectedCount).toBe(0);
    expect(body.accepted[0].message).toBe("Accepted. NEW file queued for processing.");
  });

  it("invalid header rejected", async () => {
    const r = await upload(uploadReq(csvUpload("f.csv", "Id,Foo\n1,2\n")));
    const body = await r.json();
    expect(body.rejectedCount).toBe(1);
    expect(body.rejected[0].message).toBe("Invalid CSV header. Expected: Id,Status");
  });

  it("non-csv rejected", async () => {
    const fd = new FormData();
    fd.append("files", new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "data.zip", { type: "application/zip" }));
    const r = await upload(uploadReq(fd));
    expect((await r.json()).rejected[0].message).toMatch(/^Be uploaded as a CSV/);
  });

  it.each([9, 1, 0])("invalid status code rejected: %d", async (badStatus) => {
    const r = await upload(uploadReq(csvUpload("f.csv", `Id,Status\n1,${badStatus}\n`)));
    const body = await r.json();
    expect(body.rejectedCount).toBe(1);
    expect(body.rejected[0].message).toContain("invalid status");
  });

  it("non-integer id rejected", async () => {
    const r = await upload(uploadReq(csvUpload("f.csv", "Id,Status\nabc,2\n")));
    expect((await r.json()).rejected[0].message).toContain("Id must be an integer");
  });

  it("non-integer status rejected", async () => {
    const r = await upload(uploadReq(csvUpload("f.csv", "Id,Status\n1,x\n")));
    expect((await r.json()).rejected[0].message).toContain("Status must be an integer");
  });

  it("wrong column count rejected", async () => {
    const r = await upload(uploadReq(csvUpload("f.csv", "Id,Status\n1,2,extra\n")));
    expect((await r.json()).rejected[0].message).toContain("expected 2 columns");
  });

  it("non-utf8 file rejected", async () => {
    const fd = new FormData();
    fd.append("files", new File([new Uint8Array([0xff, 0xfe, 0x00, 0x62, 0x61, 0x64])], "f.csv", { type: "text/csv" }));
    const r = await upload(uploadReq(fd));
    expect((await r.json()).rejected[0].message).toContain("Could not decode");
  });

  it("empty file rejected", async () => {
    const r = await upload(uploadReq(csvUpload("f.csv", "")));
    expect((await r.json()).rejected[0].message).toBe("Empty file.");
  });

  it("blank data rows skipped", async () => {
    const r = await upload(uploadReq(csvUpload("f.csv", "Id,Status\n1,2\n\n\n2,3\n")));
    expect((await r.json()).acceptedCount).toBe(1);
  });

  it("utf8 BOM header accepted", async () => {
    const r = await upload(uploadReq(csvUpload("f.csv", "﻿Id,Status\n1,2\n")));
    expect((await r.json()).acceptedCount).toBe(1);
  });

  it("duplicate filename in one request", async () => {
    const fd = new FormData();
    fd.append("files", new File(["Id,Status\n1,2\n"], "dup.csv", { type: "text/csv" }));
    fd.append("files", new File(["Id,Status\n2,3\n"], "dup.csv", { type: "text/csv" }));
    const r = await upload(uploadReq(fd));
    const body = await r.json();
    expect(body.acceptedCount).toBe(1);
    expect(body.rejectedCount).toBe(1);
    expect(body.rejected[0].message).toContain("same filename");
  });

  it("multiple distinct files accepted", async () => {
    const fd = new FormData();
    fd.append("files", new File(["Id,Status\n1,2\n"], "a.csv", { type: "text/csv" }));
    fd.append("files", new File(["Id,Status\n2,3\n"], "b.csv", { type: "text/csv" }));
    const r = await upload(uploadReq(fd));
    expect((await r.json()).acceptedCount).toBe(2);
  });
});

describe("amend", () => {
  it("mode amend and message", async () => {
    const r = await amend(uploadReq(csvUpload("20260312_4821_Email.csv", "Id,Status\n1,4\n")));
    const body = await r.json();
    expect(body.mode).toBe("amend");
    expect(body.accepted[0].message).toBe("Accepted. AMEND file queued for processing.");
  });
});
