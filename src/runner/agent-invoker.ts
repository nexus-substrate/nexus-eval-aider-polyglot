/**
 * Generate one Aider polyglot prediction by calling an `IModelAdapter`
 * with the exercise prompt and parsing per-file edited contents.
 *
 * v0.1 scope: model-only baseline, single round-trip. No agent loop,
 * no tool use, no test feedback. v0.2 adds (a) GitHub-fetch loader,
 * v0.3 will add an iterate-on-test-failures loop using ICliAdapter
 * against the language toolchain.
 *
 * @module runner/agent-invoker
 */

import { ok, err, type IModelAdapter, type Result } from 'nexus-agents';

import type { AiderInstance, AiderPrediction } from '../types.js';
import { extractEditedFiles } from './file-extractor.js';
import { composeUserPrompt, getSystemPrompt } from './prompt-template.js';

export interface GeneratePredictionOptions {
  /** Hard timeout for the model call. Default: 5min. */
  readonly timeoutMs?: number;
  /** Model name recorded in the prediction. Default: adapter.modelId. */
  readonly modelLabel?: string;
}

/**
 * Generate one prediction for an Aider polyglot exercise.
 *
 * Never throws — failures come back via Result.err. Empty edits
 * (model-couldn't-solve-it) are returned as ok(...) with an empty
 * editedFiles map so the orchestrator can record the attempt.
 */
export async function generatePrediction(
  instance: AiderInstance,
  modelAdapter: IModelAdapter,
  options: GeneratePredictionOptions = {}
): Promise<Result<AiderPrediction, Error>> {
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const modelLabel = options.modelLabel ?? modelAdapter.modelId;

  const start = Date.now();
  try {
    const completion = await Promise.race([
      modelAdapter.complete({
        messages: [
          { role: 'system', content: getSystemPrompt() },
          { role: 'user', content: composeUserPrompt(instance) },
        ],
      }),
      timeoutAfter<never>(timeoutMs, `model call exceeded ${String(timeoutMs)}ms`),
    ]);

    if (!completion.ok) {
      return err(new Error(completion.error.message));
    }
    const responseText = extractResponseText(completion.value);
    const edited = extractEditedFiles(responseText);

    // Filter the edited map to only paths the instance actually
    // declared as editable — drops hallucinated new files + paths
    // misformatted by the model.
    const filtered: Record<string, string> = {};
    for (const path of Object.keys(instance.editableFiles)) {
      if (edited[path] !== undefined) filtered[path] = edited[path];
    }

    return ok({
      instanceId: instance.instanceId,
      editedFiles: filtered,
      modelLabel,
      durationMs: Date.now() - start,
    });
  } catch (caught: unknown) {
    return err(caught instanceof Error ? caught : new Error(String(caught)));
  }
}

function timeoutAfter<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    const handle = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    handle.unref?.();
  });
}

function extractResponseText(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const obj = value as Record<string, unknown>;
  if (typeof obj['content'] === 'string') return obj['content'];
  if (typeof obj['text'] === 'string') return obj['text'];
  if (Array.isArray(obj['choices']) && obj['choices'].length > 0) {
    const first = obj['choices'][0] as { message?: { content?: unknown } } | undefined;
    if (
      first !== undefined &&
      typeof first.message === 'object' &&
      first.message !== null &&
      typeof first.message.content === 'string'
    ) {
      return first.message.content;
    }
  }
  return '';
}
