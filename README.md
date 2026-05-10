# nexus-eval-aider-polyglot

Aider polyglot evaluation harness for [nexus-agents](https://github.com/williamzujkowski/nexus-agents) — implements the `BenchmarkAdapter` contract from nexus-agents ≥ 2.33.1.

> **Status**: v0.1 model-only baseline. Bundled six-language smoke fixture, prompt template, fenced-block file extractor, and IModelAdapter-driven runner all wired up. GitHub-fetch loader is the v0.2 follow-up; per-language test execution (true pass/fail) is the v0.3 follow-up.

## Why Aider polyglot

The Aider polyglot benchmark scores LLM-driven code edits across **six languages** (Python, JavaScript, TypeScript, Go, Rust, C++). Where SWE-bench Pro asks "given a real issue, can the model produce a unified diff that fixes it?", Aider polyglot asks "given a small starter program in language X, can the model edit the right file(s) to satisfy the spec?".

What makes it useful alongside SWE-bench Pro:

- **Fast per-instance**: each exercise is small (1–3 files, ≤200 LOC), so a smoke run is minutes not hours.
- **Cross-language signal**: top systems often score very differently on, e.g., Rust vs. JavaScript. Single-language benchmarks hide this.
- **Edit format pressure**: the harness rewards models that emit clean whole-file edits to the *correct path*, not models that generate plausible code in the wrong place.
- **Cheap to iterate**: useful for shaking out routing decisions, prompt regressions, and adapter bugs without burning a full Pro run.

This repo follows the [nexus-agents harness-extraction policy](https://github.com/williamzujkowski/nexus-agents/issues/2514) (originally [#1960](https://github.com/williamzujkowski/nexus-agents/issues/1960)) — benchmarks live in standalone `nexus-eval-*` repos so they can evolve independently of the core.

## Install

```sh
npm install nexus-eval-aider-polyglot nexus-agents
```

`nexus-agents` is a peer dependency.

## Quick start (CLI)

```sh
# Set the OpenAI-compat endpoint
export OPENAI_API_KEY=sk-...
export OPENAI_BASE_URL=https://your-gateway/v1   # optional
export MODEL_ID=anthropic/claude-sonnet-4-6      # optional

# Smoke test against the bundled six-language fixture (no network)
npx nexus-eval-aider-polyglot --source fixture

# Run against a local Aider-AI/aider checkout
npx nexus-eval-aider-polyglot --source /path/to/aider/benchmark/exercises --limit 10

# Filter to Rust + Go only
npx nexus-eval-aider-polyglot --source fixture --languages rust,go

# JSON summary for piping
npx nexus-eval-aider-polyglot --json --source fixture > run.json
```

## Library usage

```ts
import { runBenchmark, createOpenAIAdapter } from 'nexus-agents';
import { AiderPolyglotAdapter } from 'nexus-eval-aider-polyglot';

const modelAdapter = createOpenAIAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
  modelId: 'gpt-4o',
});

const adapter = new AiderPolyglotAdapter(modelAdapter, { source: 'fixture' });
const summary = await runBenchmark(adapter, {}, { concurrency: 4 });

console.log(
  `Produced edits for ${summary.passed}/${summary.total} ` +
    `(${(summary.passRate * 100).toFixed(1)}%)`
);

const meta = summary.metadata as {
  byLanguage: Record<string, { total: number; passed: number; passRate: number }>;
};
for (const [lang, stats] of Object.entries(meta.byLanguage)) {
  console.log(`  ${lang}: ${stats.passed}/${stats.total} (${(stats.passRate * 100).toFixed(1)}%)`);
}
```

Operators with their own `IModelAdapter` (Claude API, Ollama, anything implementing the contract) can substitute it for `createOpenAIAdapter` without changing anything else.

## What v0.1 actually does

- Loads exercises from the bundled six-language fixture, or by walking a local Aider-AI/aider `benchmark/exercises/<lang>/exercises/` directory.
- Composes a whole-file edit prompt that lists each editable file's current content and asks the model to emit fenced ``` ```<lang> path=X``` ``` blocks containing the updated content.
- Filters out test files at load time so the model never sees the hidden tests.
- Parses the response into a `path → content` map, dropping any path the instance didn't declare editable.
- Reports pass/fail = "did the model produce ≥1 non-empty parsable edit", with a per-language breakdown.

## What v0.1 does NOT do

- Run the language-specific test suite (Python `pytest`, Go `go test`, etc.) against the emitted edits. Pass/fail in v0.1 is "edit produced", not "edit passes tests".
- Fetch exercises directly from `Aider-AI/aider` on GitHub (use `--source <local-path>` for now).
- Drive multi-turn agentic flows. Single round-trip only.

## Roadmap

| Issue | Scope                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------- |
| TBD   | **v0.2 — GitHub-fetch loader**. Pull exercises from `Aider-AI/aider` directly with on-disk caching.   |
| TBD   | **v0.3 — Test-based pass/fail**. Run the per-language toolchain (pytest, vitest, go test, cargo test, ctest) against emitted edits. |
| TBD   | **v0.3 — Agentic flow** via `ICliAdapter` so the model can iterate on test failures across multiple turns.  |

Cross-repo tracking lives at [nexus-agents #2519](https://github.com/williamzujkowski/nexus-agents/issues/2519) (Tier 1 prioritisation pass).

## The contract

`BenchmarkAdapter` from nexus-agents:

```ts
interface BenchmarkAdapter<TInstance, TPrediction, TEvalResult> {
  readonly name: string;
  readonly variant?: string;
  loadInstances(config): Promise<readonly TInstance[]>;
  runInstance(instance, ctx): Promise<TPrediction>;
  evaluate(instance, prediction): Promise<TEvalResult>;
  isPass(result): boolean;
  summarize(results, runTimeMs): BenchmarkRunSummary;
}
```

The orchestrator (`runBenchmark` in nexus-agents) handles concurrency, timeouts, progress, and partial failure — this repo doesn't reimplement the harness.

## License

MIT.
