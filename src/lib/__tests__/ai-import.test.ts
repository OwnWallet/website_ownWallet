import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGenerationConfig, classifyAiError, describeAiError } from "../ai/gemini";
import { DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODELS } from "../ai/models";

describe("Gemini model defaults", () => {
  it("không dùng model chậm gemini-3.8-flash làm mặc định hoặc dự phòng", () => {
    assert.notEqual(DEFAULT_GEMINI_MODEL, "gemini-3.8-flash");
    assert.ok(!FALLBACK_GEMINI_MODELS.includes("gemini-3.8-flash"));
  });
});

describe("buildGenerationConfig", () => {
  it("bật thinking minimal cho gemini-3.5-flash / 3.1-flash-lite", () => {
    const cfg: any = buildGenerationConfig("gemini-3.5-flash", { json: true });
    assert.deepEqual(cfg.thinkingConfig, { thinkingLevel: "minimal" });
    assert.equal(cfg.responseMimeType, "application/json");
    assert.ok(buildGenerationConfig("gemini-3.1-flash-lite") as any);
  });

  it("không gửi thinking minimal cho model không hỗ trợ (3.8-flash) hoặc khi tắt", () => {
    assert.equal((buildGenerationConfig("gemini-3.8-flash") as any).thinkingConfig, undefined);
    assert.equal((buildGenerationConfig("gemini-3.5-flash", { withThinking: false }) as any).thinkingConfig, undefined);
  });
});

describe("classifyAiError", () => {
  const e = (msg: string, name = "Error") => Object.assign(new Error(msg), { name });

  it("nhận diện các loại lỗi Gemini", () => {
    assert.equal(classifyAiError(e("[400 Bad Request] API key not valid. API_KEY_INVALID")), "auth");
    assert.equal(classifyAiError(e("Request aborted when fetching ... This operation was aborted")), "timeout");
    assert.equal(classifyAiError(e("x", "AbortError")), "timeout");
    assert.equal(classifyAiError(e("[429 Too Many Requests] Resource exhausted")), "quota");
    assert.equal(classifyAiError(e("[503 Service Unavailable] high demand")), "overloaded");
    assert.equal(classifyAiError(e("[404 Not Found] models/gemini-2.5-flash is not found")), "not_found");
    assert.equal(classifyAiError(e("[400 Bad Request] Thinking level MINIMAL is not supported")), "bad_config");
  });

  it("thông báo timeout gợi ý model nhanh", () => {
    assert.match(describeAiError("timeout", "gemini-3.8-flash"), /gemini-3\.5-flash/);
  });
});
