/**
 * Tests for apiRequest / ApiError — the HTTP status must be attached to the thrown error
 * (so callers like the shopping copilot bar can do `err?.status === 429`), while the
 * message keeps its historical "<status>: <body>" shape for parsers that read the body
 * out of err.message (e.g. CopilotPanel).
 *
 * queryClient.ts imports only @tanstack/react-query, so it's importable in the node test
 * env; global fetch is stubbed.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { apiRequest, ApiError } from "../queryClient";

afterEach(() => vi.unstubAllGlobals());

function mockFetch(res: Partial<Response> & { text: () => Promise<string> }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

describe("apiRequest / ApiError", () => {
  it("attaches the HTTP status to the thrown error", async () => {
    mockFetch({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => '{"error":"limit","upgradePrompt":true}' } as any);
    await expect(
      apiRequest("POST", "/api/ai/copilot/chat", { content: "hi", sessionId: "s" }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("is an ApiError and preserves the '<status>: <body>' message for legacy parsers", async () => {
    mockFetch({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => '{"error":"limit","upgradePrompt":true}' } as any);
    let caught: any;
    try {
      await apiRequest("POST", "/x", {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.status).toBe(429);
    expect(caught.message).toContain("429");
    expect(caught.message).toContain("upgradePrompt"); // body is still parseable out of the message
    expect(caught.body).toContain("upgradePrompt");
  });

  it("falls back to statusText when the body is empty", async () => {
    mockFetch({ ok: false, status: 500, statusText: "Internal Server Error", text: async () => "" } as any);
    await expect(apiRequest("GET", "/x")).rejects.toMatchObject({ status: 500, message: "500: Internal Server Error" });
  });

  it("does not throw on a 2xx response", async () => {
    mockFetch({ ok: true, status: 200, statusText: "OK", text: async () => "{}" } as any);
    const res = await apiRequest("GET", "/api/ok");
    expect(res.status).toBe(200);
  });
});
