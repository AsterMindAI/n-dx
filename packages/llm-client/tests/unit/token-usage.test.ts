import { describe, it, expect } from "vitest";
import {
  parseApiTokenUsage,
  parseApiTokenUsageWithDiagnostic,
  parseCliTokenUsage,
  parseCliCallMetadata,
  parseCliTokenUsageWithDiagnostic,
  parseStreamTokenUsage,
  parseStreamTokenUsageWithDiagnostic,
  mapCodexUsageToTokenUsage,
} from "../../src/token-usage.js";

// ── parseApiTokenUsage (Anthropic SDK response.usage) ────────────────────────

describe("parseApiTokenUsage", () => {
  it("extracts input and output tokens", () => {
    const usage = parseApiTokenUsage({
      input_tokens: 1500,
      output_tokens: 300,
    });

    expect(usage).toEqual({ input: 1500, output: 300 });
  });

  it("extracts cache token fields when present", () => {
    const usage = parseApiTokenUsage({
      input_tokens: 1000,
      output_tokens: 200,
      cache_creation_input_tokens: 500,
      cache_read_input_tokens: 300,
    });

    expect(usage).toEqual({
      input: 1000,
      output: 200,
      cacheCreationInput: 500,
      cacheReadInput: 300,
    });
  });

  it("omits cache fields when they are zero", () => {
    const usage = parseApiTokenUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });

    expect(usage).toEqual({ input: 100, output: 50 });
    expect(usage.cacheCreationInput).toBeUndefined();
    expect(usage.cacheReadInput).toBeUndefined();
  });

  it("handles partial fields (only input)", () => {
    const usage = parseApiTokenUsage({ input_tokens: 100 });
    expect(usage).toEqual({ input: 100, output: 0 });
  });

  it("handles partial fields (only output)", () => {
    const usage = parseApiTokenUsage({ output_tokens: 50 });
    expect(usage).toEqual({ input: 0, output: 50 });
  });

  it("returns zeros when no fields present", () => {
    const usage = parseApiTokenUsage({});
    expect(usage).toEqual({ input: 0, output: 0 });
  });

  it("handles non-numeric values gracefully", () => {
    const usage = parseApiTokenUsage({
      input_tokens: "bad" as unknown as number,
      output_tokens: 50,
    });

    expect(usage).toEqual({ input: 0, output: 50 });
  });
});

// ── parseCliTokenUsage (CLI --output-format json envelope) ───────────────────

describe("parseCliTokenUsage", () => {
  it("extracts input and output from standard fields", () => {
    const usage = parseCliTokenUsage({
      result: "hello",
      input_tokens: 1000,
      output_tokens: 200,
    });

    expect(usage).toEqual({ input: 1000, output: 200 });
  });

  it("extracts from total_ prefixed fields as fallback", () => {
    const usage = parseCliTokenUsage({
      total_input_tokens: 2000,
      total_output_tokens: 500,
    });

    expect(usage).toEqual({ input: 2000, output: 500 });
  });

  it("returns undefined when no token fields present", () => {
    expect(parseCliTokenUsage({ result: "hello" })).toBeUndefined();
  });

  it("extracts cache tokens when present", () => {
    const usage = parseCliTokenUsage({
      input_tokens: 1000,
      output_tokens: 200,
      cache_creation_input_tokens: 400,
      cache_read_input_tokens: 100,
    });

    expect(usage).toEqual({
      input: 1000,
      output: 200,
      cacheCreationInput: 400,
      cacheReadInput: 100,
    });
  });

  it("omits cache fields when zero", () => {
    const usage = parseCliTokenUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });

    expect(usage).toEqual({ input: 100, output: 50 });
    expect(usage?.cacheCreationInput).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(parseCliTokenUsage({})).toBeUndefined();
  });
});

// ── parseStreamTokenUsage (CLI stream-json events) ───────────────────────────

describe("parseStreamTokenUsage", () => {
  it("extracts from top-level fields", () => {
    const usage = parseStreamTokenUsage({
      type: "result",
      input_tokens: 1500,
      output_tokens: 300,
    });

    expect(usage).toEqual({ input: 1500, output: 300 });
  });

  it("extracts from total_ prefixed fields", () => {
    const usage = parseStreamTokenUsage({
      total_input_tokens: 2000,
      total_output_tokens: 500,
    });

    expect(usage).toEqual({ input: 2000, output: 500 });
  });

  it("prefers input_tokens over total_input_tokens", () => {
    const usage = parseStreamTokenUsage({
      input_tokens: 100,
      total_input_tokens: 200,
      output_tokens: 50,
    });

    expect(usage).toEqual({ input: 100, output: 50 });
  });

  it("extracts from nested usage object", () => {
    const usage = parseStreamTokenUsage({
      type: "result",
      usage: {
        input_tokens: 800,
        output_tokens: 200,
      },
    });

    expect(usage).toEqual({ input: 800, output: 200 });
  });

  it("prefers top-level fields over nested usage", () => {
    const usage = parseStreamTokenUsage({
      input_tokens: 100,
      output_tokens: 50,
      usage: {
        input_tokens: 999,
        output_tokens: 888,
      },
    });

    expect(usage).toEqual({ input: 100, output: 50 });
  });

  it("extracts cache tokens from top-level", () => {
    const usage = parseStreamTokenUsage({
      input_tokens: 1000,
      output_tokens: 200,
      cache_creation_input_tokens: 500,
      cache_read_input_tokens: 300,
    });

    expect(usage).toEqual({
      input: 1000,
      output: 200,
      cacheCreationInput: 500,
      cacheReadInput: 300,
    });
  });

  it("extracts cache tokens from nested usage", () => {
    const usage = parseStreamTokenUsage({
      type: "result",
      usage: {
        input_tokens: 1000,
        output_tokens: 200,
        cache_creation_input_tokens: 400,
        cache_read_input_tokens: 100,
      },
    });

    expect(usage).toEqual({
      input: 1000,
      output: 200,
      cacheCreationInput: 400,
      cacheReadInput: 100,
    });
  });

  it("omits cache fields when zero", () => {
    const usage = parseStreamTokenUsage({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });

    expect(usage).toEqual({ input: 100, output: 50 });
    expect(usage?.cacheCreationInput).toBeUndefined();
  });

  it("returns undefined when no token fields present", () => {
    expect(parseStreamTokenUsage({ type: "result" })).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(parseStreamTokenUsage({})).toBeUndefined();
  });

  it("handles partial fields (only input)", () => {
    const usage = parseStreamTokenUsage({ input_tokens: 100 });
    expect(usage).toEqual({ input: 100, output: 0 });
  });

  it("returns undefined when usage is not an object", () => {
    const usage = parseStreamTokenUsage({
      type: "result",
      usage: "not-an-object",
    });
    expect(usage).toBeUndefined();
  });

  it("handles partial fields in nested usage", () => {
    const usage = parseStreamTokenUsage({
      usage: { total_output_tokens: 300 },
    });
    expect(usage).toEqual({ input: 0, output: 300 });
  });
});

// ── Diagnostic-aware parsers ─────────────────────────────────────────────────

describe("parseApiTokenUsageWithDiagnostic", () => {
  it("returns complete when both fields present", () => {
    const result = parseApiTokenUsageWithDiagnostic({
      input_tokens: 100,
      output_tokens: 50,
    });
    expect(result.usage).toEqual({ input: 100, output: 50 });
    expect(result.diagnosticStatus).toBe("complete");
  });

  it("returns partial when only input present", () => {
    const result = parseApiTokenUsageWithDiagnostic({ input_tokens: 100 });
    expect(result.usage).toEqual({ input: 100, output: 0 });
    expect(result.diagnosticStatus).toBe("partial");
  });

  it("returns partial when only output present", () => {
    const result = parseApiTokenUsageWithDiagnostic({ output_tokens: 50 });
    expect(result.usage).toEqual({ input: 0, output: 50 });
    expect(result.diagnosticStatus).toBe("partial");
  });

  it("returns unavailable when no fields present", () => {
    const result = parseApiTokenUsageWithDiagnostic({});
    expect(result.usage).toEqual({ input: 0, output: 0 });
    expect(result.diagnosticStatus).toBe("unavailable");
  });

  it("returns unavailable when fields are non-numeric", () => {
    const result = parseApiTokenUsageWithDiagnostic({
      input_tokens: "bad" as unknown as number,
      output_tokens: null as unknown as number,
    });
    expect(result.usage).toEqual({ input: 0, output: 0 });
    expect(result.diagnosticStatus).toBe("unavailable");
  });

  it("includes cache fields in diagnostic result", () => {
    const result = parseApiTokenUsageWithDiagnostic({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 30,
    });
    expect(result.usage.cacheCreationInput).toBe(30);
    expect(result.diagnosticStatus).toBe("complete");
  });
});

describe("parseCliTokenUsageWithDiagnostic", () => {
  it("returns complete when both fields present", () => {
    const result = parseCliTokenUsageWithDiagnostic({
      input_tokens: 1000,
      output_tokens: 200,
    });
    expect(result.usage).toEqual({ input: 1000, output: 200 });
    expect(result.diagnosticStatus).toBe("complete");
  });

  it("returns complete with total_ prefixed fields", () => {
    const result = parseCliTokenUsageWithDiagnostic({
      total_input_tokens: 2000,
      total_output_tokens: 500,
    });
    expect(result.usage).toEqual({ input: 2000, output: 500 });
    expect(result.diagnosticStatus).toBe("complete");
  });

  it("returns unavailable when no token fields present", () => {
    const result = parseCliTokenUsageWithDiagnostic({ result: "hello" });
    expect(result.usage).toEqual({ input: 0, output: 0 });
    expect(result.diagnosticStatus).toBe("unavailable");
  });

  it("returns partial when only one field present", () => {
    const result = parseCliTokenUsageWithDiagnostic({ input_tokens: 100 });
    expect(result.usage).toEqual({ input: 100, output: 0 });
    expect(result.diagnosticStatus).toBe("partial");
  });
});

describe("parseStreamTokenUsageWithDiagnostic", () => {
  it("returns complete when both fields present", () => {
    const result = parseStreamTokenUsageWithDiagnostic({
      input_tokens: 1500,
      output_tokens: 300,
    });
    expect(result.usage).toEqual({ input: 1500, output: 300 });
    expect(result.diagnosticStatus).toBe("complete");
  });

  it("returns unavailable when no fields present", () => {
    const result = parseStreamTokenUsageWithDiagnostic({
      type: "result",
      result: "text",
    });
    expect(result.usage).toEqual({ input: 0, output: 0 });
    expect(result.diagnosticStatus).toBe("unavailable");
  });

  it("returns complete from nested usage object", () => {
    const result = parseStreamTokenUsageWithDiagnostic({
      type: "result",
      usage: {
        input_tokens: 800,
        output_tokens: 200,
      },
    });
    expect(result.usage).toEqual({ input: 800, output: 200 });
    expect(result.diagnosticStatus).toBe("complete");
  });

  it("returns partial when only one nested field present", () => {
    const result = parseStreamTokenUsageWithDiagnostic({
      usage: { total_output_tokens: 300 },
    });
    expect(result.usage).toEqual({ input: 0, output: 300 });
    expect(result.diagnosticStatus).toBe("partial");
  });

  it("returns unavailable when nested usage is not an object", () => {
    const result = parseStreamTokenUsageWithDiagnostic({
      type: "result",
      usage: "not-an-object",
    });
    expect(result.usage).toEqual({ input: 0, output: 0 });
    expect(result.diagnosticStatus).toBe("unavailable");
  });
});

// ── mapCodexUsageToTokenUsage ────────────────────────────────────────────────

describe("mapCodexUsageToTokenUsage", () => {
  it("maps top-level Codex usage fields with complete status", () => {
    const mapped = mapCodexUsageToTokenUsage({
      usage: {
        input_tokens: 1200,
        output_tokens: 300,
        total_tokens: 1500,
      },
    });
    expect(mapped.usage).toEqual({ input: 1200, output: 300 });
    expect(mapped.total).toBe(1500);
    expect(mapped.diagnosticStatus).toBe("complete");
  });

  it("maps nested response.usage payloads", () => {
    const mapped = mapCodexUsageToTokenUsage({
      response: {
        usage: {
          prompt_tokens: 800,
          completion_tokens: 200,
        },
      },
    });
    expect(mapped.usage).toEqual({ input: 800, output: 200 });
    expect(mapped.total).toBe(1000);
    expect(mapped.diagnosticStatus).toBe("complete");
  });

  it("returns unavailable when usage is absent", () => {
    const mapped = mapCodexUsageToTokenUsage({
      status: "completed",
      result: "ok",
    });
    expect(mapped.usage).toEqual({ input: 0, output: 0 });
    expect(mapped.total).toBe(0);
    expect(mapped.diagnosticStatus).toBe("unavailable");
  });

  it("returns unavailable when input is null/undefined", () => {
    const mapped = mapCodexUsageToTokenUsage(null);
    expect(mapped.diagnosticStatus).toBe("unavailable");
  });

  it("returns unavailable when usage object is empty", () => {
    const mapped = mapCodexUsageToTokenUsage({
      response: { usage: {} },
    });
    expect(mapped.usage).toEqual({ input: 0, output: 0 });
    expect(mapped.total).toBe(0);
    expect(mapped.diagnosticStatus).toBe("unavailable");
  });

  it("maps data.usage nested path", () => {
    const mapped = mapCodexUsageToTokenUsage({
      data: {
        usage: {
          input_tokens: 50,
          output_tokens: 25,
        },
      },
    });
    expect(mapped.usage).toEqual({ input: 50, output: 25 });
    expect(mapped.total).toBe(75);
    expect(mapped.diagnosticStatus).toBe("complete");
  });
});

/**
 * Regression: the Claude CLI nests token counts under `usage`, not at the
 * top level. Captured from `claude -p --output-format json` (CLI 2.1.237,
 * 2026-08-23) — the top-level keys contain no `input_tokens` at all.
 *
 * Before the fix, parseCliTokenUsage read only top-level fields, returned
 * "unavailable" -> undefined, and accumulateTokenUsage counted the call while
 * leaving both token totals at zero. That is the mechanism behind
 * `manifest.tokenUsage = {calls: 9, inputTokens: 0, outputTokens: 0}`
 * observed on a real `sourcevision analyze --full` run (TN-J3).
 */
describe("parseCliTokenUsage — real CLI envelope (nested usage)", () => {
  /** Trimmed from a real envelope; field names and nesting are verbatim. */
  const realEnvelope = {
    type: "result",
    subtype: "success",
    is_error: false,
    result: "OK",
    session_id: "77e7bda4",
    total_cost_usd: 0.081633,
    usage: {
      input_tokens: 2,
      output_tokens: 4,
      cache_creation_input_tokens: 19734,
      cache_read_input_tokens: 14792,
      service_tier: "standard",
    },
  };

  it("finds tokens nested under `usage` when absent from the top level", () => {
    const usage = parseCliTokenUsage(realEnvelope);
    expect(usage).toBeDefined();
    expect(usage?.input).toBe(2);
    expect(usage?.output).toBe(4);
  });

  it("extracts cache fields from the nested object, not the envelope root", () => {
    const usage = parseCliTokenUsage(realEnvelope);
    expect(usage?.cacheCreationInput).toBe(19734);
    expect(usage?.cacheReadInput).toBe(14792);
  });

  it("reports the nested envelope as complete, not unavailable", () => {
    expect(parseCliTokenUsageWithDiagnostic(realEnvelope).diagnosticStatus).toBe("complete");
  });

  it("still prefers top-level fields when both are present", () => {
    const usage = parseCliTokenUsage({ input_tokens: 10, output_tokens: 20, usage: { input_tokens: 1, output_tokens: 2 } });
    expect(usage?.input).toBe(10);
    expect(usage?.output).toBe(20);
  });
});

/**
 * TN-B6 — the CLI envelope carries `total_cost_usd` and `num_turns` on every call,
 * and CompletionResult had nowhere to put them. Jam's framing: a schema gap, not a
 * missing read. These assert the fields survive parsing and stay optional.
 */
describe("CompletionResult carries per-call cost and turn count (TN-B6)", () => {
  const envelope = {
    type: "result",
    result: "OK",
    total_cost_usd: 0.367548,
    num_turns: 1,
    usage: { input_tokens: 2, output_tokens: 4, cache_creation_input_tokens: 45967 },
  };

  it("surfaces total_cost_usd as costUsd", () => {
    expect(parseCliCallMetadata(envelope).costUsd).toBe(0.367548);
  });

  it("surfaces num_turns as turns", () => {
    expect(parseCliCallMetadata(envelope).turns).toBe(1);
  });

  it("leaves both undefined when the envelope omits them, rather than inventing zeros", () => {
    const meta = parseCliCallMetadata({ type: "result", result: "OK" });
    expect(meta.costUsd).toBeUndefined();
    expect(meta.turns).toBeUndefined();
  });

  it("ignores non-numeric values rather than passing them through", () => {
    const meta = parseCliCallMetadata({ total_cost_usd: "0.37", num_turns: null });
    expect(meta.costUsd).toBeUndefined();
    expect(meta.turns).toBeUndefined();
  });
});
