import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// classify.ts's gate (runClassificationGate) is the only thing that calls either classifier —
// mock the two classifier modules directly so analyze-phases.ts's real config-reading and
// classify.ts's real ELM-then-LLM routing both run for real. This is stronger than mocking
// runClassificationGate itself: it proves the gate's own sequencing (not just that
// analyze-phases.ts calls something) end to end.
vi.mock("../../src/analyzers/classify-elm.js", () => ({
  runELMGate: vi.fn(),
}));

vi.mock("../../src/analyzers/classify-llm.js", () => ({
  classifyUnclassifiedWithLLM: vi.fn(),
}));

vi.mock("../../src/analyzers/claude-client.js", async () => {
  const actual = await import("@n-dx/llm-client");
  return {
    callClaude: vi.fn(),
    ClaudeClientError: actual.ClaudeClientError,
    setClaudeConfig: vi.fn(),
    setClaudeClient: vi.fn(),
    getAuthMode: vi.fn(() => "cli"),
  };
});

import { runClassificationsPhase, type AnalyzeContext } from "../../src/cli/commands/analyze-phases.js";
import { runELMGate } from "../../src/analyzers/classify-elm.js";
import { classifyUnclassifiedWithLLM } from "../../src/analyzers/classify-llm.js";
import { DATA_FILES, DEFAULT_ELM_CONFIDENCE_THRESHOLD } from "../../src/cli/sourcevision-core.js";
import type { Inventory, Imports } from "../../src/schema/index.js";

const mockedRunELMGate = vi.mocked(runELMGate);
const mockedClassifyUnclassifiedWithLLM = vi.mocked(classifyUnclassifiedWithLLM);

function makeInventory(paths: string[]): Inventory {
  return {
    files: paths.map((path) => ({
      path,
      size: 100,
      language: "TypeScript",
      lineCount: 10,
      hash: "abc",
      role: "source" as const,
      category: "code",
    })),
    summary: {
      totalFiles: paths.length,
      totalLines: paths.length * 10,
      byLanguage: { TypeScript: paths.length },
      byRole: { source: paths.length },
      byCategory: { code: paths.length },
    },
  };
}

const emptyImports: Imports = {
  edges: [],
  external: [],
  summary: {
    totalEdges: 0,
    totalExternal: 0,
    circularCount: 0,
    circulars: [],
    mostImported: [],
    avgImportsPerFile: 0,
  },
};

// "src/index.ts" resolves via the algorithmic pass (entrypoint); "src/mystery.ts" matches no
// signal and reaches the ELM/LLM gate unclassified.
const MIXED_INVENTORY = makeInventory(["src/index.ts", "src/mystery.ts"]);
// Every file here resolves algorithmically — used to test the "no unclassified files" skip.
const FULLY_CLASSIFIED_INVENTORY = makeInventory(["src/index.ts"]);

async function setupProject(tmpDir: string, inventory: Inventory, ndxConfig?: Record<string, unknown>): Promise<AnalyzeContext> {
  const svDir = join(tmpDir, ".sourcevision");
  await mkdir(svDir, { recursive: true });
  await writeFile(join(svDir, DATA_FILES.inventory), JSON.stringify(inventory));
  await writeFile(join(svDir, DATA_FILES.imports), JSON.stringify(emptyImports));
  if (ndxConfig) {
    await writeFile(join(tmpDir, ".n-dx.json"), JSON.stringify(ndxConfig));
  }
  return {
    absDir: tmpDir,
    svDir,
    fullMode: false,
    fastMode: false,
    tokenUsage: { calls: 0, inputTokens: 0, outputTokens: 0 },
    inventoryResult: null,
  };
}

async function readClassifications(ctx: AnalyzeContext) {
  const raw = await readFile(join(ctx.svDir, DATA_FILES.classifications), "utf-8");
  return JSON.parse(raw);
}

describe("classification gate wiring in runClassificationsPhase", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sv-elm-wiring-"));
    mockedRunELMGate.mockReset();
    mockedClassifyUnclassifiedWithLLM.mockReset();
    mockedClassifyUnclassifiedWithLLM.mockResolvedValue({ updatedFiles: [], tokenUsage: { calls: 0, inputTokens: 0, outputTokens: 0 } });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("skips the ELM stage entirely when elmPrefilter.enabled is unset (opt-in default)", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY); // no .n-dx.json at all
    mockedClassifyUnclassifiedWithLLM.mockResolvedValueOnce({
      updatedFiles: [{ path: "src/mystery.ts", archetype: "service", confidence: 0.7, source: "llm" }],
      tokenUsage: { calls: 1, inputTokens: 10, outputTokens: 5 },
    });

    await runClassificationsPhase(ctx);

    expect(mockedRunELMGate).not.toHaveBeenCalled();
    expect(mockedClassifyUnclassifiedWithLLM).toHaveBeenCalledTimes(1);

    const classifications = await readClassifications(ctx);
    const mystery = classifications.files.find((f: any) => f.path === "src/mystery.ts");
    expect(mystery.archetype).toBe("service");
    expect(mystery.source).toBe("llm");
  });

  it("resolves files via the ELM stage and never reaches the LLM once fully resolved", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });
    mockedRunELMGate.mockReturnValueOnce({
      updatedFiles: [{ path: "src/mystery.ts", archetype: "service", confidence: 0.5, source: "elm" }],
    });

    await runClassificationsPhase(ctx);

    expect(mockedRunELMGate).toHaveBeenCalledTimes(1);
    expect(mockedRunELMGate.mock.calls[0][3]).toEqual({ confidenceThreshold: DEFAULT_ELM_CONFIDENCE_THRESHOLD, seed: 20260812 });
    // Nothing left unclassified — the LLM fallback must not run at all.
    expect(mockedClassifyUnclassifiedWithLLM).not.toHaveBeenCalled();

    const classifications = await readClassifications(ctx);
    const mystery = classifications.files.find((f: any) => f.path === "src/mystery.ts");
    expect(mystery.archetype).toBe("service");
    expect(mystery.source).toBe("elm");
  });

  it("honors a confidenceThreshold override from .n-dx.json", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true, confidenceThreshold: 0.5 } } },
    });
    mockedRunELMGate.mockReturnValueOnce({ updatedFiles: [] });
    mockedClassifyUnclassifiedWithLLM.mockResolvedValueOnce({
      updatedFiles: [{ path: "src/mystery.ts", archetype: "service", confidence: 0.7, source: "llm" }],
      tokenUsage: { calls: 1, inputTokens: 10, outputTokens: 5 },
    });

    await runClassificationsPhase(ctx);

    expect(mockedRunELMGate.mock.calls[0][3]).toEqual({ confidenceThreshold: 0.5, seed: 20260812 });
  });

  it("skips the ELM stage when there are no unclassified files", async () => {
    const ctx = await setupProject(tmpDir, FULLY_CLASSIFIED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });

    await runClassificationsPhase(ctx);

    expect(mockedRunELMGate).not.toHaveBeenCalled();
    expect(mockedClassifyUnclassifiedWithLLM).not.toHaveBeenCalled();
  });

  it("skips both the ELM stage and the LLM fallback in fast mode", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });
    ctx.fastMode = true;

    await runClassificationsPhase(ctx);

    expect(mockedRunELMGate).not.toHaveBeenCalled();
    expect(mockedClassifyUnclassifiedWithLLM).not.toHaveBeenCalled();
  });

  it("falls through to the LLM when the ELM stage resolves nothing", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });
    mockedRunELMGate.mockReturnValueOnce({ updatedFiles: [] });
    mockedClassifyUnclassifiedWithLLM.mockResolvedValueOnce({
      updatedFiles: [{ path: "src/mystery.ts", archetype: "service", confidence: 0.7, source: "llm" }],
      tokenUsage: { calls: 1, inputTokens: 10, outputTokens: 5 },
    });

    await runClassificationsPhase(ctx);

    expect(mockedRunELMGate).toHaveBeenCalledTimes(1);
    expect(mockedClassifyUnclassifiedWithLLM).toHaveBeenCalledTimes(1);

    const classifications = await readClassifications(ctx);
    const mystery = classifications.files.find((f: any) => f.path === "src/mystery.ts");
    expect(mystery.source).toBe("llm");
  });
});
