/**
 * Library entry point — public exports of the Aider polyglot harness.
 *
 * @module index
 */

export { AiderPolyglotAdapter } from './adapter.js';
export type {
  AiderAdapterConfig,
  AiderEvalResult,
  AiderInstance,
  AiderPrediction,
  PolyglotLanguage,
} from './types.js';

// Lower-level building blocks for piecemeal consumption.
export { loadAiderInstances } from './runner/instance-loader.js';
export { generatePrediction } from './runner/agent-invoker.js';
export type { GeneratePredictionOptions } from './runner/agent-invoker.js';
export { extractEditedFiles } from './runner/file-extractor.js';
export { composeUserPrompt, getSystemPrompt } from './runner/prompt-template.js';
