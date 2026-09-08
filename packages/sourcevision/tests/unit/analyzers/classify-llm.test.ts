import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyUnclassifiedWithLLM } from "../../../src/analyzers/classify-llm.js";
import { callClaude } from "../../../src/analyzers/claude-client.js";
import type { ArchetypeDefinition, FileClassification } from "../../../src/schema/index.js";

vi.mock("../../../src/analyzers/claude-client.js", async () => {
  const actual = await import("@n-dx/llm-client");
  return {
    callClaude: vi.fn(),
    ClaudeClientError: actual.ClaudeClientError,
    setClaudeConfig: vi.fn(),
    setClaudeClient: vi.fn(),
    getAuthMode: vi.fn(() => "cli"),
  };
});

const mockedCallClaude = vi.mocked(callClaude);

const ARCHETYPES: ArchetypeDefinition[] = [
  { id: "service", name: "Service", description: "Service layer", signals: [] },
  { id: "utility", name: "Utility", description: "Utility module", signals: [] },
  { id: "route-handler", name: "Route handler", description: "HTTP route handler", signals: [] },
];

function unclassifiedFile(path: string, evidence?: FileClassification["evidence"]): FileClassification {
  return { path, archetype: null, confidence: 0, source: "algorithmic", evidence };
}

describe("classifyUnclassifiedWithLLM", () => {
  beforeEach(() => {
    mockedCallClaude.mockReset();
  });

  it("classifies unclassified files via LLM", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([
        { path: "src/analyzer.ts", archetype: "service", reason: "Analysis engine module" },
        { path: "src/processor.ts", archetype: "utility", reason: "Data processing utility" },
      ]),
    });

    const result = await classifyUnclassifiedWithLLM(
      [unclassifiedFile("src/analyzer.ts"), unclassifiedFile("src/processor.ts")],
      ARCHETYPES,
    );

    expect(result.updatedFiles).toHaveLength(2);
    expect(result.updatedFiles.find((f) => f.path === "src/analyzer.ts")!.archetype).toBe("service");
    expect(result.updatedFiles.find((f) => f.path === "src/analyzer.ts")!.source).toBe("llm");
    expect(result.updatedFiles.find((f) => f.path === "src/processor.ts")!.archetype).toBe("utility");
    expect(result.tokenUsage.calls).toBe(1);
  });

  it("skips when given no unclassified files", async () => {
    const result = await classifyUnclassifiedWithLLM([], ARCHETYPES);

    expect(result.updatedFiles).toHaveLength(0);
    expect(result.tokenUsage.calls).toBe(0);
    expect(mockedCallClaude).not.toHaveBeenCalled();
  });

  it("handles LLM returning invalid archetype IDs", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([
        { path: "src/analyzer.ts", archetype: "nonexistent-type", reason: "Made up" },
      ]),
    });

    const result = await classifyUnclassifiedWithLLM([unclassifiedFile("src/analyzer.ts")], ARCHETYPES);

    // Invalid archetype IDs should be filtered out
    expect(result.updatedFiles).toHaveLength(0);
  });

  it("handles LLM returning JSON in markdown fences", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      text: '```json\n[{"path":"src/analyzer.ts","archetype":"service","reason":"Analysis module"}]\n```',
    });

    const result = await classifyUnclassifiedWithLLM([unclassifiedFile("src/analyzer.ts")], ARCHETYPES);

    expect(result.updatedFiles).toHaveLength(1);
    expect(result.updatedFiles[0].archetype).toBe("service");
  });

  it("retries on invalid JSON then succeeds", async () => {
    // First call: garbage
    mockedCallClaude.mockResolvedValueOnce({ text: "not json at all" });
    // Second call: valid
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([
        { path: "src/analyzer.ts", archetype: "service", reason: "Analysis module" },
      ]),
    });

    const result = await classifyUnclassifiedWithLLM([unclassifiedFile("src/analyzer.ts")], ARCHETYPES);

    expect(result.updatedFiles).toHaveLength(1);
    expect(mockedCallClaude).toHaveBeenCalledTimes(2);
  });

  it("stops on auth error", async () => {
    const { ClaudeClientError } = await import("@n-dx/llm-client");

    mockedCallClaude.mockRejectedValueOnce(
      new ClaudeClientError("Auth failed", "auth", false),
    );

    const result = await classifyUnclassifiedWithLLM([unclassifiedFile("src/analyzer.ts")], ARCHETYPES);

    expect(result.updatedFiles).toHaveLength(0);
    expect(mockedCallClaude).toHaveBeenCalledTimes(1);
  });

  it("includes evidence with LLM reason", async () => {
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([
        { path: "src/analyzer.ts", archetype: "service", reason: "Core analysis engine" },
      ]),
    });

    const result = await classifyUnclassifiedWithLLM([unclassifiedFile("src/analyzer.ts")], ARCHETYPES);

    expect(result.updatedFiles[0].evidence).toBeDefined();
    expect(result.updatedFiles[0].evidence![0].detail).toBe("Core analysis engine");
    expect(result.updatedFiles[0].evidence![0].archetypeId).toBe("service");
  });

  it("accumulates token usage across retries", async () => {
    // First call: garbage response with token usage
    mockedCallClaude.mockResolvedValueOnce({
      text: "not json",
      tokenUsage: { input: 100, output: 50 },
    });
    // Second call: valid response with token usage
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([
        { path: "src/analyzer.ts", archetype: "service", reason: "Analysis module" },
      ]),
      tokenUsage: { input: 200, output: 80 },
    });

    const result = await classifyUnclassifiedWithLLM([unclassifiedFile("src/analyzer.ts")], ARCHETYPES);

    expect(result.tokenUsage.calls).toBe(2);
    expect(result.tokenUsage.inputTokens).toBe(300);
    expect(result.tokenUsage.outputTokens).toBe(130);
  });

  it("batches more than LLM_BATCH_SIZE (30) unclassified files", async () => {
    const files = Array.from({ length: 35 }, (_, i) => unclassifiedFile(`src/f${i}.ts`));
    // A non-empty parsed response avoids the retry path — the point of this test is the batch
    // count, not the per-file match outcome.
    mockedCallClaude.mockResolvedValue({
      text: JSON.stringify([{ path: "src/f0.ts", archetype: "service", reason: "x" }]),
    });

    await classifyUnclassifiedWithLLM(files, ARCHETYPES);

    expect(mockedCallClaude).toHaveBeenCalledTimes(2);
  });
});
