import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FEATURE_VERSION,
  FEATURE_VECTOR_SIZE,
  EXT_VOCAB,
  EXT_BLOCK_SIZE,
  OFFSET_EXT,
  OFFSET_PATH_SCALARS,
  OFFSET_PATH_TOKENS,
  OFFSET_CONTENT_TOKENS,
  OFFSET_STRUCTURAL,
  STRUCTURAL_BLOCK_SIZE,
  STRUCTURAL_FEATURE_NAMES,
  PATH_TOKEN_BUCKETS,
  CONTENT_TOKEN_BUCKETS,
  MAX_CONTENT_BYTES,
  hashToken,
  tokenizePath,
  tokenizeContent,
  structuralFeatures,
  readFileContentSafely,
  buildFeatureVector,
} from "../../../src/analyzers/classify-elm-features.js";

const tempDirs: string[] = [];
function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "elm-features-"));
  tempDirs.push(d);
  return d;
}
afterEach(() => {
  while (tempDirs.length) {
    const d = tempDirs.pop()!;
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

function structIndex(name: (typeof STRUCTURAL_FEATURE_NAMES)[number]): number {
  return STRUCTURAL_FEATURE_NAMES.indexOf(name);
}

// ── hashToken ────────────────────────────────────────────────────────────────

describe("hashToken", () => {
  // The whole persisted-model story depends on this. If the same token hashed to a different
  // bucket in the session that LOADS a model than in the one that TRAINED it, every trained
  // weight would point at the wrong feature and the model would be silently worthless.
  it("is stable for known inputs (pins the FNV-1a constants against accidental change)", () => {
    expect(hashToken("")).toBe(0x811c9dc5);
    expect(hashToken("a")).toBe(0xe40c292c);
    expect(hashToken("foobar")).toBe(0xbf9cf968);
  });

  it("is deterministic across repeated calls", () => {
    expect(hashToken("classifyWithELM")).toBe(hashToken("classifyWithELM"));
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const t of ["", "a", "src/analyzers/classify.ts", "éèê"]) {
      const h = hashToken(t);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("distinguishes different tokens", () => {
    expect(hashToken("store")).not.toBe(hashToken("hook"));
  });
});

// ── tokenization ─────────────────────────────────────────────────────────────

describe("tokenizePath", () => {
  it("splits on separators and keeps each segment", () => {
    expect(tokenizePath("src/utils/format.ts")).toEqual(["src", "utils", "format", "ts"]);
  });

  it("splits camelCase into parts while keeping the whole segment", () => {
    const tokens = tokenizePath("src/branchWorkStore.ts");
    expect(tokens).toContain("branchworkstore");
    expect(tokens).toContain("branch");
    expect(tokens).toContain("work");
    expect(tokens).toContain("store");
  });

  it("handles consecutive acronyms (parseHTTPResponse -> parse, http, response)", () => {
    const tokens = tokenizePath("src/parseHTTPResponse.ts");
    expect(tokens).toContain("parse");
    expect(tokens).toContain("http");
    expect(tokens).toContain("response");
  });

  it("handles Windows separators", () => {
    expect(tokenizePath("src\\utils\\format.ts")).toEqual(["src", "utils", "format", "ts"]);
  });

  it("returns an empty array for an empty path", () => {
    expect(tokenizePath("")).toEqual([]);
  });
});

describe("tokenizeContent", () => {
  it("extracts identifiers and ignores punctuation and numbers", () => {
    const tokens = tokenizeContent("const total = 42 + price;");
    expect(tokens).toContain("const");
    expect(tokens).toContain("total");
    expect(tokens).toContain("price");
    expect(tokens).not.toContain("42");
  });

  it("splits camelCase identifiers into parts", () => {
    const tokens = tokenizeContent("function getUserName() {}");
    expect(tokens).toContain("getusername");
    expect(tokens).toContain("get");
    expect(tokens).toContain("user");
    expect(tokens).toContain("name");
  });

  it("returns an empty array for content with no identifiers", () => {
    expect(tokenizeContent("{} [] () ;;; 123")).toEqual([]);
  });
});

// ── structural features ──────────────────────────────────────────────────────
//
// One test per feature: these are the interpretable half of the vector, so a single wrong
// regex should fail on its own rather than hide inside an aggregate assertion.

describe("structuralFeatures", () => {
  it("produces one value per declared feature name", () => {
    const out = structuralFeatures("const a = 1;", "src/a.ts");
    expect(out).toHaveLength(STRUCTURAL_BLOCK_SIZE);
    expect(STRUCTURAL_FEATURE_NAMES).toHaveLength(STRUCTURAL_BLOCK_SIZE);
  });

  it("counts imports and require calls", () => {
    const withImports = structuralFeatures(
      'import a from "a";\nimport b from "b";\n',
      "src/a.ts",
    )[structIndex("importCount")];
    const without = structuralFeatures("const a = 1;", "src/a.ts")[structIndex("importCount")];
    expect(withImports).toBeGreaterThan(without);
    expect(without).toBe(0);
  });

  it("counts exports", () => {
    const v = structuralFeatures("export const a = 1;\nexport function b() {}\n", "src/a.ts");
    expect(v[structIndex("exportCount")]).toBeGreaterThan(0);
  });

  it("detects a default export", () => {
    expect(
      structuralFeatures("export default function App() {}", "src/a.ts")[
        structIndex("hasDefaultExport")
      ],
    ).toBe(1);
    expect(
      structuralFeatures("export const a = 1;", "src/a.ts")[structIndex("hasDefaultExport")],
    ).toBe(0);
  });

  it("detects JSX by capitalized tags, not by lowercase HTML", () => {
    expect(
      structuralFeatures("return <UserCard name={n} />;", "src/a.tsx")[structIndex("hasJsx")],
    ).toBe(1);
    // A lowercase tag alone is ambiguous with generics/comparisons, so it must not fire.
    expect(structuralFeatures("if (a < b && c > d) {}", "src/a.ts")[structIndex("hasJsx")]).toBe(0);
  });

  it("detects a test file by content or by path", () => {
    expect(
      structuralFeatures('describe("x", () => {});', "src/a.ts")[structIndex("isTestFile")],
    ).toBe(1);
    expect(
      structuralFeatures("const a = 1;", "tests/unit/a.test.ts")[structIndex("isTestFile")],
    ).toBe(1);
    expect(structuralFeatures("const a = 1;", "src/a.ts")[structIndex("isTestFile")]).toBe(0);
  });

  it("counts class and function declarations", () => {
    const v = structuralFeatures(
      "export class Foo {}\nexport async function bar() {}\n",
      "src/a.ts",
    );
    expect(v[structIndex("classCount")]).toBeGreaterThan(0);
    expect(v[structIndex("functionCount")]).toBeGreaterThan(0);
  });

  it("counts arrow functions", () => {
    expect(
      structuralFeatures("const f = () => { return 1; };", "src/a.ts")[
        structIndex("arrowFunctionCount")
      ],
    ).toBeGreaterThan(0);
  });

  it("counts interface and type declarations", () => {
    expect(
      structuralFeatures("export interface A { x: number }\ntype B = string;\n", "src/a.ts")[
        structIndex("typeDeclCount")
      ],
    ).toBeGreaterThan(0);
  });

  it("detects React hook usage by the use-prefix call shape", () => {
    expect(
      structuralFeatures("const [a, b] = useState(0);", "src/a.tsx")[structIndex("reactHookUsage")],
    ).toBe(1);
    // The known false-positive shape from this project's collision list: a generic callback
    // named "...hook" is not a React hook.
    expect(
      structuralFeatures("export function validateToken() {}", "src/token-validation-hook.ts")[
        structIndex("reactHookUsage")
      ],
    ).toBe(0);
  });

  it("detects route definitions", () => {
    expect(
      structuralFeatures('app.get("/users", handler);', "src/a.ts")[structIndex("routeDefinition")],
    ).toBe(1);
    expect(structuralFeatures("const a = 1;", "src/a.ts")[structIndex("routeDefinition")]).toBe(0);
  });

  it("detects CommonJS exports", () => {
    expect(
      structuralFeatures("module.exports = foo;", "src/a.js")[structIndex("commonJsExport")],
    ).toBe(1);
  });

  it("counts async usage", () => {
    expect(
      structuralFeatures("async function a() {}\nconst b = async () => {};", "src/a.ts")[
        structIndex("asyncCount")
      ],
    ).toBeGreaterThan(0);
  });

  it("detects env access", () => {
    expect(
      structuralFeatures("const k = process.env.KEY;", "src/a.ts")[structIndex("envAccess")],
    ).toBe(1);
  });

  it("detects schema builders", () => {
    expect(
      structuralFeatures("const S = z.object({ a: z.string() });", "src/a.ts")[
        structIndex("schemaBuilder")
      ],
    ).toBe(1);
  });

  it("scales line count logarithmically so a huge file cannot dominate", () => {
    const small = structuralFeatures("a\nb\nc", "src/a.ts")[structIndex("lineCount")];
    const huge = structuralFeatures("x\n".repeat(10_000), "src/a.ts")[structIndex("lineCount")];
    expect(huge).toBeGreaterThan(small);
    expect(huge).toBeLessThan(small * 10); // log-scaled, not linear
  });
});

// ── readFileContentSafely: the degradation paths ─────────────────────────────

describe("readFileContentSafely", () => {
  it("reads a normal file", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "a.ts"), "export const a = 1;\n");
    expect(readFileContentSafely(dir, "a.ts")).toContain("export const a");
  });

  it("returns undefined for a missing file instead of throwing", () => {
    const dir = makeTempDir();
    expect(() => readFileContentSafely(dir, "nope.ts")).not.toThrow();
    expect(readFileContentSafely(dir, "nope.ts")).toBeUndefined();
  });

  it("returns undefined for a directory", () => {
    const dir = makeTempDir();
    mkdirSync(join(dir, "sub"));
    expect(readFileContentSafely(dir, "sub")).toBeUndefined();
  });

  it("returns undefined for a binary file", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "bin.dat"), Buffer.from([0x01, 0x00, 0x02, 0x00, 0x03]));
    expect(readFileContentSafely(dir, "bin.dat")).toBeUndefined();
  });

  it("returns an empty string for an empty file (readable, just empty)", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "empty.ts"), "");
    expect(readFileContentSafely(dir, "empty.ts")).toBe("");
  });

  it("truncates at the read cap rather than loading an unbounded file", () => {
    const dir = makeTempDir();
    writeFileSync(join(dir, "big.ts"), "a".repeat(MAX_CONTENT_BYTES * 2));
    expect(readFileContentSafely(dir, "big.ts")!.length).toBe(MAX_CONTENT_BYTES);
  });
});

// ── buildFeatureVector ───────────────────────────────────────────────────────

describe("buildFeatureVector", () => {
  it("declares a feature version so a model cannot be loaded under a different layout", () => {
    expect(FEATURE_VERSION).toBe(1);
  });

  it("produces a fixed width regardless of content length", () => {
    const tiny = buildFeatureVector({ path: "src/a.ts", content: "const a = 1;" });
    const huge = buildFeatureVector({
      path: "src/a.ts",
      content: "export const value = compute();\n".repeat(3000),
    });
    const none = buildFeatureVector({ path: "src/a.ts" });
    expect(tiny).toHaveLength(FEATURE_VECTOR_SIZE);
    expect(huge).toHaveLength(FEATURE_VECTOR_SIZE);
    expect(none).toHaveLength(FEATURE_VECTOR_SIZE);
  });

  it("is deterministic for identical input", () => {
    const a = buildFeatureVector({ path: "src/utils/format.ts", content: "export const a = 1;" });
    const b = buildFeatureVector({ path: "src/utils/format.ts", content: "export const a = 1;" });
    expect(a).toEqual(b);
  });

  // THE PREMISE OF TJ-E1. The evidence-vector representation is all-zero for exactly this kind
  // of file (see classify-elm.test.ts's contrast test); this one must never be.
  it("is never all-zero for a file with no algorithmic signal whatsoever", () => {
    const vec = buildFeatureVector({ path: "src/random9000.ts" });
    expect(vec.some((v) => v !== 0)).toBe(true);
  });

  it("is never all-zero even for an empty file at an unrecognized path", () => {
    const vec = buildFeatureVector({ path: "x", content: "" });
    expect(vec.some((v) => v !== 0)).toBe(true);
  });

  it("contains no NaN when content is absent (zero-slice normalization guard)", () => {
    const vec = buildFeatureVector({ path: "src/random9000.ts" });
    expect(vec.every((v) => Number.isFinite(v))).toBe(true);
    // Content and structural blocks must be exactly zero, not NaN, in the degraded case.
    for (let i = OFFSET_CONTENT_TOKENS; i < OFFSET_STRUCTURAL + STRUCTURAL_BLOCK_SIZE; i++) {
      expect(vec[i]).toBe(0);
    }
  });

  it("contains no NaN for content with no identifiers at all", () => {
    const vec = buildFeatureVector({ path: "src/a.ts", content: "{} [] ;;; 123" });
    expect(vec.every((v) => Number.isFinite(v))).toBe(true);
  });

  it("sets exactly one extension slot", () => {
    const vec = buildFeatureVector({ path: "src/a.tsx", content: "x" });
    const block = vec.slice(OFFSET_EXT, OFFSET_EXT + EXT_BLOCK_SIZE);
    expect(block.filter((v) => v !== 0)).toHaveLength(1);
    expect(block[EXT_VOCAB.indexOf(".tsx")]).toBe(1);
  });

  it("routes an unknown extension to the OTHER slot rather than dropping it", () => {
    const vec = buildFeatureVector({ path: "src/a.zzz", content: "x" });
    const block = vec.slice(OFFSET_EXT, OFFSET_EXT + EXT_BLOCK_SIZE);
    expect(block[EXT_VOCAB.length]).toBe(1);
    expect(block.filter((v) => v !== 0)).toHaveLength(1);
  });

  it("distinguishes files that differ only in content", () => {
    const a = buildFeatureVector({ path: "src/a.ts", content: "export class Repository {}" });
    const b = buildFeatureVector({ path: "src/a.ts", content: "export const styles = css``;" });
    expect(a).not.toEqual(b);
  });

  it("distinguishes files that differ only in path", () => {
    const a = buildFeatureVector({ path: "src/routes/users.ts", content: "const x = 1;" });
    const b = buildFeatureVector({ path: "src/models/user.ts", content: "const x = 1;" });
    expect(a).not.toEqual(b);
  });

  // Content is the axis no prior representation in this project used. If adding content did not
  // change the vector, the whole ADR would be pointless -- so assert it directly.
  it("content changes the vector for an otherwise-identical path", () => {
    const withContent = buildFeatureVector({ path: "src/a.ts", content: "export class Foo {}" });
    const withoutContent = buildFeatureVector({ path: "src/a.ts" });
    expect(withContent).not.toEqual(withoutContent);
  });

  it("keeps each block inside its own offset range", () => {
    const vec = buildFeatureVector({ path: "src/utils/format.ts", content: "export const a = 1;" });
    expect(OFFSET_PATH_TOKENS + PATH_TOKEN_BUCKETS).toBe(OFFSET_CONTENT_TOKENS);
    expect(OFFSET_CONTENT_TOKENS + CONTENT_TOKEN_BUCKETS).toBe(OFFSET_STRUCTURAL);
    expect(OFFSET_STRUCTURAL + STRUCTURAL_BLOCK_SIZE).toBe(FEATURE_VECTOR_SIZE);
    expect(vec.slice(OFFSET_PATH_SCALARS, OFFSET_PATH_TOKENS).some((v) => v !== 0)).toBe(true);
  });

  it("L2-normalizes each block independently so no block dominates by magnitude", () => {
    const vec = buildFeatureVector({
      path: "src/a.ts",
      content: "export const value = compute();\n".repeat(2000),
    });
    const norm = (from: number, to: number) =>
      Math.sqrt(vec.slice(from, to).reduce((s, v) => s + v * v, 0));
    expect(norm(OFFSET_PATH_TOKENS, OFFSET_CONTENT_TOKENS)).toBeCloseTo(1, 5);
    expect(norm(OFFSET_CONTENT_TOKENS, OFFSET_STRUCTURAL)).toBeCloseTo(1, 5);
    expect(norm(OFFSET_STRUCTURAL, FEATURE_VECTOR_SIZE)).toBeCloseTo(1, 5);
  });
});
