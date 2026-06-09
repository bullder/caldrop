import { unzipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as sandboxDownload } from "@/app/sandbox/data/download/route";
import { POST as sandboxAmend } from "@/app/sandbox/data/amend/route";
import { POST as sandboxUpload } from "@/app/sandbox/data/upload/route";
import { LIST_TYPES } from "@/lib/lists";
import { authHeaders, csvUpload, seedTemp } from "./helpers";

beforeEach(() => {
  seedTemp();
});

describe("sandbox download", () => {
  it("mirrors /data/download under the /sandbox prefix", async () => {
    const r = await sandboxDownload(
      new Request("http://test/sandbox/data/download", { headers: authHeaders() }),
    );
    expect(r.status).toBe(200);
    const names = Object.keys(unzipSync(new Uint8Array(await r.arrayBuffer())));
    expect(names.length).toBe(LIST_TYPES.length);
    expect(names).toContain("20260312_4821_Email.csv");
  });

  it("still enforces auth", async () => {
    const r = await sandboxDownload(new Request("http://test/sandbox/data/download"));
    expect(r.status).toBe(401);
  });
});

describe("sandbox upload / amend", () => {
  it("upload accepts a valid file (mode new)", async () => {
    const r = await sandboxUpload(
      new Request("http://test/sandbox/data/upload", {
        method: "POST",
        headers: authHeaders(),
        body: csvUpload("f.csv", "Id,Status\n1,2\n"),
      }),
    );
    const body = await r.json();
    expect(body.mode).toBe("new");
    expect(body.acceptedCount).toBe(1);
  });

  it("amend reports mode amend", async () => {
    const r = await sandboxAmend(
      new Request("http://test/sandbox/data/amend", {
        method: "POST",
        headers: authHeaders(),
        body: csvUpload("f.csv", "Id,Status\n1,4\n"),
      }),
    );
    expect((await r.json()).mode).toBe("amend");
  });
});
