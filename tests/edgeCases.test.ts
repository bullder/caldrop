import { beforeEach, describe, expect, it } from "vitest";
import { GET as download } from "@/app/data/download/route";
import { POST as upload } from "@/app/data/upload/route";
import { resetEdgeCaseState } from "@/lib/testBehaviors";
import { authHeaders, csvUpload, seedTemp } from "./helpers";

beforeEach(() => {
  seedTemp();
  resetEdgeCaseState();
});

function downloadReq(key: string): Request {
  return new Request("http://test/data/download", { headers: authHeaders(key) });
}

function uploadReq(key: string, form: FormData): Request {
  return new Request("http://test/data/upload", {
    method: "POST",
    headers: authHeaders(key),
    body: form,
  });
}

describe("edge-case download keys", () => {
  it("edge-nodata-key -> 200, no-data message, no ZIP", async () => {
    const r = await download(downloadReq("edge-nodata-key"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).not.toBe("application/zip");
    const body = await r.json();
    expect(typeof body.message).toBe("string");
  });

  it("edge-batch-incomplete-key -> 409", async () => {
    const r = await download(downloadReq("edge-batch-incomplete-key"));
    expect(r.status).toBe(409);
  });

  it("edge-building-key -> 202 + Retry-After", async () => {
    const r = await download(downloadReq("edge-building-key"));
    expect(r.status).toBe(202);
    expect(r.headers.get("retry-after")).toBe("1");
  });

  it("edge-building-key stays 202 on repeated polls", async () => {
    const a = await download(downloadReq("edge-building-key"));
    const b = await download(downloadReq("edge-building-key"));
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
  });

  it("edge-malformed-key -> 200, but not a valid {message} shape", async () => {
    const r = await download(downloadReq("edge-malformed-key"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).not.toBe("application/zip");
    const body = await r.json();
    expect(typeof body.message).not.toBe("string");
  });

  it("default keys are unaffected -> still return a real zip", async () => {
    const r = await download(downloadReq("dev-key-123"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
  });
});

describe("edge-case upload keys", () => {
  it("edge-dup-filename-key: first call rejects as duplicate", async () => {
    const r = await upload(
      uploadReq("edge-dup-filename-key", csvUpload("f.csv", "Id,Status\n1,2\n")),
    );
    const body = await r.json();
    expect(body.rejectedCount).toBe(1);
    expect(body.rejected[0].message).toContain("same filename");
  });

  it("edge-dup-filename-key: retry of the same filename accepts", async () => {
    await upload(uploadReq("edge-dup-filename-key", csvUpload("f.csv", "Id,Status\n1,2\n")));
    const r = await upload(
      uploadReq("edge-dup-filename-key", csvUpload("f.csv", "Id,Status\n1,2\n")),
    );
    const body = await r.json();
    expect(body.acceptedCount).toBe(1);
    expect(body.rejectedCount).toBe(0);
  });

  it("edge-dup-filename-key: a different filename still rejects on its own first call", async () => {
    await upload(uploadReq("edge-dup-filename-key", csvUpload("f.csv", "Id,Status\n1,2\n")));
    const r = await upload(
      uploadReq("edge-dup-filename-key", csvUpload("f_retry01.csv", "Id,Status\n1,2\n")),
    );
    const body = await r.json();
    expect(body.rejectedCount).toBe(1);
  });

  it("edge-reject-key: always rejects, even on retry", async () => {
    await upload(uploadReq("edge-reject-key", csvUpload("f.csv", "Id,Status\n1,2\n")));
    const r = await upload(uploadReq("edge-reject-key", csvUpload("f.csv", "Id,Status\n1,2\n")));
    const body = await r.json();
    expect(body.rejectedCount).toBe(1);
    expect(body.acceptedCount).toBe(0);
  });

  it("default keys are unaffected -> normal accept", async () => {
    const r = await upload(uploadReq("dev-key-123", csvUpload("f.csv", "Id,Status\n1,2\n")));
    const body = await r.json();
    expect(body.acceptedCount).toBe(1);
  });
});
