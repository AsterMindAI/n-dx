/**
 * ELM classifier wrapper — the engine, script-tier.
 *
 * Implements the interface fixed by
 * Claude-Context/ADR/ADR-2026-08-23-butter-elm-inference-module.md § Decision 3, so
 * that promotion into packages/llm-client/src/elm/ is transcription, not redesign.
 *
 * The probability is returned as a NUMBER and never rendered to a string. That is the
 * entire reason the ADR rejected registering the ELM as a provider vendor: the
 * text-in/text-out provider seam destroys it, and the confidence gate is the design.
 */

import { ELM } from "@astermind/astermind-community";
import { buildElmConfig } from "./config.mjs";

/**
 * @typedef {{ label: string, prob: number }} ElmPrediction
 * @typedef {{ text: string, label: string }} ElmTrainingRow
 */

export class ElmClassifier {
  #elm = null;
  #config;
  #categories;
  #trained = false;
  #trainMs = null;

  /** @param {{ categories: string[] } & Record<string, unknown>} options */
  constructor(options) {
    this.#config = buildElmConfig(options);
    this.#categories = this.#config.categories;
  }

  /** Labels this classifier can emit, in the order given at construction. */
  get categories() { return [...this.#categories]; }

  /** Milliseconds the last train() took — the input to the ADR's 2s revisit threshold. */
  get trainMs() { return this.#trainMs; }

  /**
   * Train in-process. Per ADR § Decision 4 we deliberately do not serialise a model
   * until training is measured too slow; `trainMs` is what that decision is revisited on.
   *
   * @param {ElmTrainingRow[]} rows
   */
  train(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("elm-prototype: train() needs a non-empty array of {text, label} rows.");
    }
    const unknown = [...new Set(rows.map((r) => r.label))].filter((l) => !this.#categories.includes(l));
    if (unknown.length > 0) {
      throw new Error(
        `elm-prototype: training rows carry labels not in categories: ${unknown.join(", ")}. ` +
        `Pass every label to the constructor — the ELM cannot emit a category it was not built with.`,
      );
    }
    this.#elm = new ELM(this.#config);
    const t0 = process.hrtime.bigint();
    this.#elm.train(rows);
    this.#trainMs = Number(process.hrtime.bigint() - t0) / 1e6;
    this.#trained = true;
    return this;
  }

  #assertTrained() {
    if (!this.#trained) throw new Error("elm-prototype: call train() before predict().");
  }

  /**
   * Ordered best-first. Maps onto sourcevision's existing `secondaryArchetypes`.
   * @returns {ElmPrediction[]}
   */
  predict(text, topK = 1) {
    this.#assertTrained();
    const out = this.#elm.predict(text, topK) ?? [];
    return out.map((p) => ({ label: String(p.label), prob: Number(p.prob) }));
  }

  /**
   * The fallthrough contract: returns null below `threshold` so the caller leaves its
   * field unset and the existing hosted path handles the item exactly as it does today.
   * Disabling the ELM must produce byte-identical output.
   *
   * @returns {ElmPrediction | null}
   */
  classifyGated(text, threshold) {
    if (typeof threshold !== "number" || Number.isNaN(threshold)) {
      throw new Error("elm-prototype: classifyGated() requires a numeric threshold.");
    }
    const [top] = this.predict(text, 1);
    if (!top) return null;
    return top.prob >= threshold ? top : null;
  }
}
