import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Partial mock: keep every real export from the gateway (analyzeClassifications,
// enrichClassificationsWithLLM, mergeClassificationResults, DEFAULT_ELM_CONFIDENCE_THRESHOLD,
// etc.) but replace the two ELM entry points so the wiring in runClassificationsPhase can be
// exercised without depending on the ELM's actual numeric behavior (that's covered by
// tests/unit/analyzers/classify-elm.test.ts).
vi.mock("../../src/cli/sourcevision-core.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/cli/sourcevision-core.js")>();
  return {
    ...actual,
    getArchetypeELM: vi.fn(),
    classifyWithELM: vi.fn(),
  };
});

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
import { getArchetypeELM, classifyWithELM, DEFAULT_ELM_CONFIDENCE_THRESHOLD, DATA_FILES } from "../../src/cli/sourcevision-core.js";
import { callClaude } from "../../src/analyzers/claude-client.js";
import type { Inventory, Imports } from "../../src/schema/index.js";

const mockedGetArchetypeELM = vi.mocked(getArchetypeELM);
const mockedClassifyWithELM = vi.mocked(classifyWithELM);
const mockedCallClaude = vi.mocked(callClaude);

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
// signal and reaches the LLM fallback (or the ELM pre-filter, when enabled) unclassified.
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

describe("ELM pre-filter wiring in runClassificationsPhase", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sv-elm-wiring-"));
    mockedGetArchetypeELM.mockReset();
    mockedClassifyWithELM.mockReset();
    mockedCallClaude.mockReset();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("skips the ELM stage entirely when elmPrefilter.enabled is unset (opt-in default)", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY); // no .n-dx.json at all
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([{ path: "src/mystery.ts", archetype: "service", reason: "Looks like a service" }]),
    });

    await runClassificationsPhase(ctx);

    expect(mockedGetArchetypeELM).not.toHaveBeenCalled();
    expect(mockedClassifyWithELM).not.toHaveBeenCalled();
    expect(mockedCallClaude).toHaveBeenCalledTimes(1);

    const classifications = await readClassifications(ctx);
    const mystery = classifications.files.find((f: any) => f.path === "src/mystery.ts");
    expect(mystery.archetype).toBe("service");
    expect(mystery.source).toBe("llm");
  });

  it("resolves files via the ELM stage and never reaches the LLM once fully resolved", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });
    mockedGetArchetypeELM.mockReturnValueOnce({ elm: {} as any, categories: ["service"] });
    mockedClassifyWithELM.mockReturnValueOnce({
      updatedFiles: [{ path: "src/mystery.ts", archetype: "service", confidence: 0.5, source: "elm" }],
    });

    await runClassificationsPhase(ctx);

    expect(mockedGetArchetypeELM).toHaveBeenCalledTimes(1);
    expect(mockedClassifyWithELM).toHaveBeenCalledTimes(1);
    expect(mockedClassifyWithELM.mock.calls[0][4]).toBe(DEFAULT_ELM_CONFIDENCE_THRESHOLD);
    // Nothing left unclassified — the LLM fallback must not run at all.
    expect(mockedCallClaude).not.toHaveBeenCalled();

    const classifications = await readClassifications(ctx);
    const mystery = classifications.files.find((f: any) => f.path === "src/mystery.ts");
    expect(mystery.archetype).toBe("service");
    expect(mystery.source).toBe("elm");
  });

  it("honors a confidenceThreshold override from .n-dx.json", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true, confidenceThreshold: 0.5 } } },
    });
    mockedGetArchetypeELM.mockReturnValueOnce({ elm: {} as any, categories: ["service"] });
    mockedClassifyWithELM.mockReturnValueOnce({ updatedFiles: [] });
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([{ path: "src/mystery.ts", archetype: "service", reason: "Looks like a service" }]),
    });

    await runClassificationsPhase(ctx);

    expect(mockedClassifyWithELM.mock.calls[0][4]).toBe(0.5);
  });

  it("skips the ELM stage when there are no unclassified files", async () => {
    const ctx = await setupProject(tmpDir, FULLY_CLASSIFIED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });

    await runClassificationsPhase(ctx);

    expect(mockedGetArchetypeELM).not.toHaveBeenCalled();
    expect(mockedCallClaude).not.toHaveBeenCalled();
  });

  it("skips both the ELM stage and the LLM fallback in fast mode", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });
    ctx.fastMode = true;

    await runClassificationsPhase(ctx);

    expect(mockedGetArchetypeELM).not.toHaveBeenCalled();
    expect(mockedClassifyWithELM).not.toHaveBeenCalled();
    expect(mockedCallClaude).not.toHaveBeenCalled();
  });

  it("falls through to the LLM when no usable ELM model is available", async () => {
    const ctx = await setupProject(tmpDir, MIXED_INVENTORY, {
      sourcevision: { classification: { elmPrefilter: { enabled: true } } },
    });
    mockedGetArchetypeELM.mockReturnValueOnce(undefined);
    mockedCallClaude.mockResolvedValueOnce({
      text: JSON.stringify([{ path: "src/mystery.ts", archetype: "service", reason: "Looks like a service" }]),
    });

    await runClassificationsPhase(ctx);

    expect(mockedGetArchetypeELM).toHaveBeenCalledTimes(1);
    expect(mockedClassifyWithELM).not.toHaveBeenCalled();
    expect(mockedCallClaude).toHaveBeenCalledTimes(1);

    const classifications = await readClassifications(ctx);
    const mystery = classifications.files.find((f: any) => f.path === "src/mystery.ts");
    expect(mystery.source).toBe("llm");
  });
});
