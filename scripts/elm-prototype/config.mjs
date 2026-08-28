/**
 * Configuration and validation for the ELM prototype.
 *
 * The library's traps are enforced here as code rather than described in comments,
 * because the next person will pass a charSet in from config and a comment will not
 * stop them.
 */

/**
 * Default character set.
 *
 * ⚠️ The literal '-' MUST stay last. `charSet` is interpolated **unescaped** into a
 * RegExp character class, so a '-' anywhere else forms an invalid range and throws
 * from deep inside the library. Enforced by assertValidCharSet below.
 *
 * ⚠️ UPPERCASE IS REQUIRED and is NOT in the hello-world's charSet. Measured against
 * the 324-row corpus: 20 distinct capitals (A, C, D, E, ... W) appear in real paths —
 * `AsterMind-Community-Edition`, `CONTEXT.md` and friends. Characters outside charSet
 * are dropped, so omitting them silently deletes signal.
 */
export const DEFAULT_CHAR_SET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./_-";

/** Split paths on separators so directory names become tokens. */
export const DEFAULT_TOKENIZER_DELIMITER = /[/._-]+/;

/** Matches scripts/elm-hello-world.mjs, so results are comparable to the smoke test. */
export const DEFAULT_SEED = 42;
export const DEFAULT_HIDDEN_UNITS = 512;
/**
 * ⚠️ 32 is the hello-world's value and it is WRONG for real corpora.
 *
 * Measured against the 324-row corpus: median path is 43 chars and the longest is 65,
 * so maxLen 32 truncated 282 of 324 paths (87%) — and it truncates the TAIL, which is
 * where the filename lives. `packages/sourcevision/src/cli/serve.ts` became
 * `packages/sourcevision/src/cli/se`, discarding the single most discriminative token.
 *
 * With maxLen 32 the model emitted near-uniform probabilities (~0.077 = 1/13) and
 * scored 4.8% against a 37.3% baseline — a result that looks exactly like "the ELM
 * cannot do this task" and was in fact a truncation bug.
 *
 * 80 covers the observed maximum with headroom. Re-check if a corpus adds deeper paths.
 */
export const DEFAULT_MAX_LEN = 80;
export const DEFAULT_ACTIVATION = "relu";

/**
 * Fail fast, with our own message, on a charSet the library would reject obscurely.
 *
 * @throws {Error} if a literal '-' appears anywhere but last.
 */
export function assertValidCharSet(charSet) {
  if (typeof charSet !== "string" || charSet.length === 0) {
    throw new Error("elm-prototype: charSet must be a non-empty string.");
  }
  const i = charSet.indexOf("-");
  if (i !== -1 && i !== charSet.length - 1) {
    throw new Error(
      `elm-prototype: charSet has a literal '-' at index ${i}, but it must be LAST. ` +
      `charSet is interpolated unescaped into a RegExp character class, so a '-' ` +
      `elsewhere forms an invalid range (e.g. "a-z0" -> range a..z then a stray 0, ` +
      `or worse, "._-/" -> invalid range _..\/) and the library throws obscurely. ` +
      `Move '-' to the end: ${JSON.stringify(charSet.replace(/-/g, "") + "-")}`,
    );
  }
  return charSet;
}

/**
 * Build a validated ELM config.
 *
 * `useTokenizer` is forced on: text training throws without it, and every use here
 * is text.
 */
export function buildElmConfig({
  categories,
  seed = DEFAULT_SEED,
  hiddenUnits = DEFAULT_HIDDEN_UNITS,
  maxLen = DEFAULT_MAX_LEN,
  activation = DEFAULT_ACTIVATION,
  charSet = DEFAULT_CHAR_SET,
  tokenizerDelimiter = DEFAULT_TOKENIZER_DELIMITER,
  modelName = "elm-prototype",
} = {}) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error("elm-prototype: categories must be a non-empty array of label strings.");
  }
  assertValidCharSet(charSet);
  return {
    categories,
    hiddenUnits,
    maxLen,
    activation,
    charSet,
    useTokenizer: true,
    tokenizerDelimiter,
    seed,
    log: { modelName, verbose: false },
  };
}
