import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractNumericExamples,
  trainArchetypeELMNumeric,
  predictArchetypeNumeric,
  hasEnoughHistoryForFreshTraining,
  canUseBaselineModel,
  loadBaselineArchetypeELM,
  getArchetypeELM,
  classifyWithELM,
} from "../../../src/analyzers/classify-elm.js";
import { analyzeClassifications } from "../../../src/analyzers/classify.js";
import { BUILTIN_ARCHETYPES } from "../../../src/analyzers/archetypes.js";
import type {
  Inventory,
  Imports,
  Classifications,
  FileClassification,
  ArchetypeDefinition,
} from "../../../src/schema/index.js";

// ── Helpers (mirrors classify.test.ts's makeInventory/makeImports) ─────────

function makeInventory(entries: Array<{ path: string; role?: string }>): Inventory {
  const files = entries.map((e) => ({
    path: e.path,
    size: 100,
    language: "TypeScript",
    lineCount: 10,
    hash: "abc",
    role: (e.role ?? "source") as any,
    category: "code",
  }));
  return {
    files,
    summary: {
      totalFiles: files.length,
      totalLines: files.length * 10,
      byLanguage: { TypeScript: files.length },
      byRole: { source: files.length },
      byCategory: { code: files.length },
    },
  } as Inventory;
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

// ── extractNumericExamples ──────────────────────────────────────────────────

describe("extractNumericExamples", () => {
  it("builds one vector per resolved file, sized to the archetype catalog", () => {
    const inv = makeInventory([{ path: "src/index.ts" }, { path: "src/utils/format.ts" }]);
    const classifications = analyzeClassifications(inv, emptyImports);

    const examples = extractNumericExamples(classifications, inv, emptyImports);

    expect(examples).toHaveLength(2);
    for (const ex of examples) {
      expect(ex.vector).toHaveLength(classifications.archetypes.length);
    }
    expect(examples.find((e) => e.archetype === "entrypoint")).toBeDefined();
    expect(examples.find((e) => e.archetype === "utility")).toBeDefined();
  });

  it("excludes files with no resolved archetype", () => {
    const inv = makeInventory([{ path: "src/index.ts" }, { path: "src/analyzer.ts" }]);
    const classifications = analyzeClassifications(inv, emptyImports);
    // Sanity: analyzer.ts has no algorithmic signal (see classify.test.ts's own fixture)
    expect(classifications.files.find((f) => f.path === "src/analyzer.ts")!.archetype).toBeNull();

    const examples = extractNumericExamples(classifications, inv, emptyImports);
    expect(examples.map((e) => e.archetype)).toEqual(["entrypoint"]);
  });

  it("excludes non-source-role files even if a label was force-set on them", () => {
    const inv = makeInventory([{ path: "src/index.ts" }, { path: "src/fixture.json", role: "config" }]);
    const classifications = analyzeClassifications(inv, emptyImports);
    const withFakeLabel: Classifications = {
      ...classifications,
      files: classifications.files.map((f) =>
        f.path === "src/fixture.json" ? { ...f, archetype: "config", source: "algorithmic" as const } : f,
      ),
    };

    const examples = extractNumericExamples(withFakeLabel, inv, emptyImports);
    expect(examples.some((e) => e.archetype === "config")).toBe(false);
  });

  it("excludes source values other than algorithmic/llm", () => {
    const inv = makeInventory([{ path: "src/index.ts" }]);
    const classifications = analyzeClassifications(inv, emptyImports);
    const overridden: Classifications = {
      ...classifications,
      files: classifications.files.map((f) => ({ ...f, source: "user-override" as const })),
    };

    expect(extractNumericExamples(overridden, inv, emptyImports)).toHaveLength(0);
  });
});

// ── trainArchetypeELMNumeric ─────────────────────────────────────────────────

describe("trainArchetypeELMNumeric", () => {
  it("throws when there are no examples to infer vector length from", () => {
    expect(() => trainArchetypeELMNumeric([], [], 1)).toThrow(/no examples to infer vector length/);
  });

  it("throws when no example matches the given category set", () => {
    expect(() =>
      trainArchetypeELMNumeric([{ vector: [1, 0], archetype: "a" }], ["b"], 1),
    ).toThrow(/no examples matched the given category set/);
  });

  it("trains successfully on separable numeric data", () => {
    const examples = [
      { vector: [1, 0, 0], archetype: "a" },
      { vector: [0.9, 0.1, 0], archetype: "a" },
      { vector: [0, 1, 0], archetype: "b" },
      { vector: [0.1, 0.9, 0], archetype: "b" },
      { vector: [0, 0, 1], archetype: "c" },
      { vector: [0, 0.1, 0.9], archetype: "c" },
    ];
    const trained = trainArchetypeELMNumeric(examples, ["a", "b", "c"], 42);
    expect(trained.categories).toEqual(["a", "b", "c"]);
    expect(trained.elm).toBeDefined();
  });
});

// ── predictArchetypeNumeric ──────────────────────────────────────────────────

describe("predictArchetypeNumeric", () => {
  it("predicts the matching category for a clearly separable vector", () => {
    const examples = [
      { vector: [1, 0, 0], archetype: "a" },
      { vector: [0.95, 0.05, 0], archetype: "a" },
      { vector: [0, 1, 0], archetype: "b" },
      { vector: [0.05, 0.95, 0], archetype: "b" },
      { vector: [0, 0, 1], archetype: "c" },
      { vector: [0, 0.05, 0.95], archetype: "c" },
    ];
    const trained = trainArchetypeELMNumeric(examples, ["a", "b", "c"], 42);

    const prediction = predictArchetypeNumeric(trained, [1, 0, 0]);
    expect(prediction.archetype).toBe("a");
    expect(prediction.confidence).toBeGreaterThan(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });
});

// ── hasEnoughHistoryForFreshTraining ─────────────────────────────────────────

describe("hasEnoughHistoryForFreshTraining", () => {
  function makeLabeled(n: number, archetype: string, source: "algorithmic" | "llm"): FileClassification[] {
    return Array.from({ length: n }, (_, i) => ({
      path: `src/${archetype}/${source}-${i}.ts`,
      archetype,
      confidence: 0.8,
      source,
    }));
  }

  function wrap(files: FileClassification[]): Classifications {
    return {
      archetypes: [],
      files,
      summary: { totalClassified: files.length, totalUnclassified: 0, byArchetype: {}, bySource: {} },
    };
  }

  it("is false with too few labeled examples", () => {
    expect(hasEnoughHistoryForFreshTraining(wrap(makeLabeled(10, "utility", "llm")))).toBe(false);
  });

  it("is false with too few distinct categories", () => {
    const files = [...makeLabeled(20, "utility", "llm"), ...makeLabeled(15, "utility", "algorithmic")];
    expect(hasEnoughHistoryForFreshTraining(wrap(files))).toBe(false);
  });

  it("is false with too few LLM-sourced examples even once volume and category gates pass", () => {
    const files = [
      ...makeLabeled(15, "utility", "algorithmic"),
      ...makeLabeled(10, "service", "algorithmic"),
      ...makeLabeled(10, "model", "algorithmic"),
      ...makeLabeled(5, "utility", "llm"), // only 5 llm-sourced; gate requires 20
    ];
    expect(hasEnoughHistoryForFreshTraining(wrap(files))).toBe(false);
  });

  it("is true once volume, category, and LLM-sourced thresholds all clear", () => {
    const files = [
      ...makeLabeled(10, "utility", "algorithmic"),
      ...makeLabeled(10, "service", "llm"),
      ...makeLabeled(10, "model", "llm"),
    ];
    expect(hasEnoughHistoryForFreshTraining(wrap(files))).toBe(true);
  });
});

// ── canUseBaselineModel ──────────────────────────────────────────────────────

describe("canUseBaselineModel", () => {
  it("is true when the archetype catalog is exactly the built-in set", () => {
    const classifications = analyzeClassifications(makeInventory([{ path: "src/index.ts" }]), emptyImports);
    expect(canUseBaselineModel(classifications)).toBe(true);
  });

  it("is false when a custom archetype extends the catalog", () => {
    const custom: ArchetypeDefinition[] = [
      {
        id: "totally-custom",
        name: "Custom",
        description: "Custom",
        signals: [{ kind: "directory", pattern: "/custom/", weight: 0.9 }],
      },
    ];
    const classifications = analyzeClassifications(
      makeInventory([{ path: "src/custom/thing.ts" }]),
      emptyImports,
      { customArchetypes: custom },
    );
    expect(classifications.archetypes.length).toBe(BUILTIN_ARCHETYPES.length + 1);
    expect(canUseBaselineModel(classifications)).toBe(false);
  });
});

// ── loadBaselineArchetypeELM ─────────────────────────────────────────────────

describe("loadBaselineArchetypeELM", () => {
  it("loads the bundled baseline artifact and can predict without throwing", () => {
    const trained = loadBaselineArchetypeELM();
    expect(trained.categories.length).toBeGreaterThan(0);

    const artifactPath = join(import.meta.dirname, "../../../src/analyzers/classify-elm-baseline-model.json");
    const artifact = JSON.parse(readFileSync(artifactPath, "utf-8"));
    const vector = new Array(artifact.catalogSize).fill(0);

    const prediction = predictArchetypeNumeric(trained, vector);
    expect(trained.categories).toContain(prediction.archetype);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });
});

// ── getArchetypeELM (model lifecycle) ────────────────────────────────────────

describe("getArchetypeELM", () => {
  it("returns undefined when history is insufficient and the catalog isn't the built-in set", () => {
    const custom: ArchetypeDefinition[] = [
      {
        id: "totally-custom",
        name: "Custom",
        description: "Custom",
        signals: [{ kind: "directory", pattern: "/custom/", weight: 0.9 }],
      },
    ];
    const inv = makeInventory([{ path: "src/custom/thing.ts" }]);
    const classifications = analyzeClassifications(inv, emptyImports, { customArchetypes: custom });

    expect(getArchetypeELM(classifications, inv, emptyImports, 1)).toBeUndefined();
  });

  it("falls back to the bundled baseline when history is insufficient but the catalog is built-in only", () => {
    const inv = makeInventory([{ path: "src/index.ts" }]);
    const classifications = analyzeClassifications(inv, emptyImports);

    const trained = getArchetypeELM(classifications, inv, emptyImports, 1);
    const baseline = loadBaselineArchetypeELM();
    expect(trained?.categories).toEqual(baseline.categories);
  });

  it("trains fresh once history clears the cold-start thresholds", () => {
    const paths = [
      ...Array.from({ length: 10 }, (_, i) => `src/utils/u${i}.ts`),
      ...Array.from({ length: 10 }, (_, i) => `src/services/s${i}.ts`),
      ...Array.from({ length: 10 }, (_, i) => `src/models/m${i}.ts`),
    ];
    const inv = makeInventory(paths.map((path) => ({ path })));
    const fresh = analyzeClassifications(inv, emptyImports);
    // Sanity: real algorithmic signal (directory match, weight 0.8) already resolves all 30
    expect(fresh.summary.totalUnclassified).toBe(0);

    // Relabel the services/models subset as "llm"-sourced to clear the LLM-example-count gate
    // without touching the (already-correct) archetype labels.
    const files = fresh.files.map((f) =>
      f.path.startsWith("src/services/") || f.path.startsWith("src/models/")
        ? { ...f, source: "llm" as const }
        : f,
    );
    const classifications: Classifications = { ...fresh, files };
    expect(hasEnoughHistoryForFreshTraining(classifications)).toBe(true);

    const trained = getArchetypeELM(classifications, inv, emptyImports, 7);
    expect(trained?.categories).toEqual(["model", "service", "utility"]);
  });
});

// ── classifyWithELM ──────────────────────────────────────────────────────────

describe("classifyWithELM", () => {
  const PROBE_PATH = "src/utils/probe.ts";
  const ZERO_EVIDENCE_PATH = "src/random9000.ts"; // matches no filename/directory/export signal

  const trainingPaths = [
    ...Array.from({ length: 10 }, (_, i) => `src/utils/u${i}.ts`),
    ...Array.from({ length: 10 }, (_, i) => `src/services/s${i}.ts`),
    ...Array.from({ length: 10 }, (_, i) => `src/models/m${i}.ts`),
  ];
  const inv = makeInventory([...trainingPaths, PROBE_PATH, ZERO_EVIDENCE_PATH].map((path) => ({ path })));
  const fresh = analyzeClassifications(inv, emptyImports);

  // Sanity on the fixture itself before using it as a test input.
  if (fresh.files.find((f) => f.path === PROBE_PATH)!.archetype !== "utility") {
    throw new Error("test fixture assumption broken: probe path no longer classifies as utility");
  }
  if (fresh.files.find((f) => f.path === ZERO_EVIDENCE_PATH)!.archetype !== null) {
    throw new Error("test fixture assumption broken: zero-evidence path unexpectedly classified");
  }

  // Build the classifications object used both to train (30 real-labeled files, 20 of them
  // relabeled "llm"-sourced to clear the history gate) and as classifyWithELM's target
  // population (PROBE_PATH and ZERO_EVIDENCE_PATH left null/algorithmic, exactly like real
  // unclassified files reaching the pre-filter).
  const trainingClassifications: Classifications = {
    ...fresh,
    files: fresh.files.map((f) => {
      if (f.path === PROBE_PATH) return { ...f, archetype: null, confidence: 0, source: "algorithmic" as const };
      if (f.path.startsWith("src/services/") || f.path.startsWith("src/models/")) {
        return { ...f, source: "llm" as const };
      }
      return f;
    }),
  };

  const trained = getArchetypeELM(trainingClassifications, inv, emptyImports, 7)!;

  it("never resolves a file with zero evidence, even at a threshold of 0", () => {
    const result = classifyWithELM(trainingClassifications, inv, emptyImports, trained, 0);
    expect(result.updatedFiles.some((f) => f.path === ZERO_EVIDENCE_PATH)).toBe(false);
  });

  it("resolves a file with weak-but-nonzero evidence once its confidence clears the threshold", () => {
    const result = classifyWithELM(trainingClassifications, inv, emptyImports, trained, 0);
    const probeResult = result.updatedFiles.find((f) => f.path === PROBE_PATH);
    expect(probeResult).toBeDefined();
    expect(probeResult!.archetype).toBe("utility");
    expect(probeResult!.source).toBe("elm");
  });

  it("leaves the same file untouched once the threshold exceeds its actual confidence", () => {
    const atZero = classifyWithELM(trainingClassifications, inv, emptyImports, trained, 0);
    const observedConfidence = atZero.updatedFiles.find((f) => f.path === PROBE_PATH)!.confidence;

    const tooHigh = classifyWithELM(
      trainingClassifications,
      inv,
      emptyImports,
      trained,
      Math.min(observedConfidence + 0.1, 1.0001),
    );
    expect(tooHigh.updatedFiles.find((f) => f.path === PROBE_PATH)).toBeUndefined();
  });

  it("only targets files that are still unclassified via the algorithmic pass", () => {
    const result = classifyWithELM(trainingClassifications, inv, emptyImports, trained, 0);
    // The 30 training files all already have a real (non-null) archetype — none should
    // reappear in the ELM's output, regardless of what the model would predict for them.
    expect(result.updatedFiles.every((f) => f.path === PROBE_PATH)).toBe(true);
  });
});
