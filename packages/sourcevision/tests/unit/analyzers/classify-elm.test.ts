import { describe, it, expect } from "vitest";
import {
  ELM_GATE_ENABLED,
  trainClassifyPathELM,
  predictWithClassifyPathELM,
  type ClassifyPathELMModel,
} from "../../../src/analyzers/classify-elm.js";
import type { Classifications, FileClassification } from "../../../src/schema/index.js";

function makeClassifications(
  files: Array<{ path: string; archetype: string | null; source?: FileClassification["source"] }>,
  archetypeIds: string[],
): Classifications {
  return {
    archetypes: archetypeIds.map((id) => ({ id, name: id, description: id, signals: [] })),
    files: files.map((f) => ({
      path: f.path,
      archetype: f.archetype,
      confidence: f.archetype ? 0.5 : 0,
      source: f.source ?? "algorithmic",
    })),
    summary: { totalClassified: 0, totalUnclassified: 0, byArchetype: {}, bySource: {} },
  };
}

describe("ELM_GATE_ENABLED", () => {
  it("defaults to false (shadow mode)", () => {
    expect(ELM_GATE_ENABLED).toBe(false);
  });
});

describe("trainClassifyPathELM", () => {
  it("returns null with fewer than the minimum labeled examples", () => {
    const files = Array.from({ length: 5 }, (_, i) => ({ path: `src/file${i}.ts`, archetype: "utility" }));
    const classifications = makeClassifications(files, ["utility", "component"]);

    expect(trainClassifyPathELM(classifications)).toBeNull();
  });

  it("does not count unclassified (archetype: null) files toward the training floor", () => {
    const files = Array.from({ length: 25 }, (_, i) => ({ path: `src/x${i}.ts`, archetype: null }));
    const classifications = makeClassifications(files, ["utility"]);

    expect(trainClassifyPathELM(classifications)).toBeNull();
  });

  it("does not count user-override entries toward the training floor", () => {
    const files = Array.from({ length: 25 }, (_, i) => ({
      path: `src/x${i}.ts`,
      archetype: "utility",
      source: "user-override" as const,
    }));
    const classifications = makeClassifications(files, ["utility"]);

    expect(trainClassifyPathELM(classifications)).toBeNull();
  });

  it("trains a model once the minimum is met with algorithmic- and llm-sourced labels", () => {
    const routeFiles = Array.from({ length: 13 }, (_, i) => ({
      path: `src/server/routes/handler-${i}.route.ts`,
      archetype: "route-handler",
      source: "algorithmic" as const,
    }));
    const componentFiles = Array.from({ length: 12 }, (_, i) => ({
      path: `src/components/Widget${i}.tsx`,
      archetype: "component",
      source: "llm" as const,
    }));
    const classifications = makeClassifications([...routeFiles, ...componentFiles], ["route-handler", "component"]);

    const model = trainClassifyPathELM(classifications);

    expect(model).not.toBeNull();
    expect(model!.categories).toEqual(["route-handler", "component"]);
  });
});

describe("predictWithClassifyPathELM", () => {
  function fakeModel(probs: number[], categories: string[]): ClassifyPathELMModel {
    return {
      categories,
      encoder: { normalize: (v: number[]) => v, encode: () => [0] } as unknown as ClassifyPathELMModel["encoder"],
      elm: { predictProbaFromVector: () => probs } as unknown as ClassifyPathELMModel["elm"],
    };
  }

  it("returns null when the top1/top2 margin is below the confidence threshold", () => {
    const model = fakeModel([0.51, 0.49], ["a", "b"]);

    expect(predictWithClassifyPathELM("whatever.ts", model)).toBeNull();
  });

  it("returns the top archetype with confidence and margin when the prediction is confident", () => {
    const model = fakeModel([0.9, 0.1], ["a", "b"]);

    expect(predictWithClassifyPathELM("whatever.ts", model)).toEqual({
      archetype: "a",
      confidence: 0.9,
      margin: 0.8,
    });
  });

  it("picks the correct runner-up for the margin when the top class isn't index 0", () => {
    const model = fakeModel([0.05, 0.85, 0.1], ["a", "b", "c"]);

    expect(predictWithClassifyPathELM("whatever.ts", model)).toEqual({
      archetype: "b",
      confidence: 0.85,
      margin: 0.75,
    });
  });
});

// End-to-end sanity check with the real @astermind/astermind-community ELM (no mocking) — confirms
// the train→predict round trip actually works, not just the margin arithmetic above. Mirrors
// scripts/classify-elm-eval.mjs's method on a much smaller fixture. Skipped from the accuracy
// claims in the ADR/IMPL on purpose: this is a smoke test, not evidence — see
// scripts/classify-elm-eval-results.md for the real number.
describe("trainClassifyPathELM + predictWithClassifyPathELM (real ELM, no mocks)", () => {
  it("trains on a small distinctive corpus and predicts a same-pattern held-out path", () => {
    const routeFiles = Array.from({ length: 15 }, (_, i) => ({
      path: `src/server/routes/handler-${i}.route.ts`,
      archetype: "route-handler",
    }));
    const componentFiles = Array.from({ length: 15 }, (_, i) => ({
      path: `src/components/Widget${i}.tsx`,
      archetype: "component",
    }));
    const classifications = makeClassifications([...routeFiles, ...componentFiles], ["route-handler", "component"]);

    const model = trainClassifyPathELM(classifications);
    expect(model).not.toBeNull();

    const prediction = predictWithClassifyPathELM("src/server/routes/handler-new.route.ts", model!);
    // Not asserting a specific outcome beyond "the round trip runs and returns a well-formed
    // result or null" — a 30-example fixture is too small to assert a specific label reliably.
    // The real accuracy claim lives in scripts/classify-elm-eval-results.md, not here.
    if (prediction) {
      expect(model!.categories).toContain(prediction.archetype);
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.margin).toBeGreaterThanOrEqual(0);
    }
  });
});
