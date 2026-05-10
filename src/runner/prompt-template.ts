/**
 * Prompt composition for Aider polyglot exercises.
 *
 * The prompt asks the model to produce updated full-file content
 * (NOT a unified diff) for each editable file. Aider's own benchmark
 * uses both whole-file edits and search/replace blocks; v0.1 picks
 * whole-file because it's simpler to parse and the polyglot
 * exercises typically only have 1-2 files. v0.3 follow-up can add
 * search/replace + diff edit modes per Aider's "edit format" options.
 *
 * @module runner/prompt-template
 */

import type { AiderInstance } from '../types.js';

const SYSTEM_PROMPT = `You are an expert software engineer solving a polyglot programming exercise.

You will receive:
1. A natural-language problem statement.
2. The starter content of each file you must edit.
3. The programming language for the exercise.

Produce the COMPLETE updated content for EACH editable file. Do not produce unified diffs; emit the full file content.

For each file, wrap the full content in a fenced code block tagged with the path and an appropriate language hint:

\`\`\`<lang> path=<relative-path>
<full updated file contents>
\`\`\`

Rules:

- Emit one fenced block per editable file. The path attribute MUST exactly match the input path.
- Do not modify file paths; do not introduce new files.
- Output ONLY the fenced blocks. No prose before, between, or after.
- If you cannot solve the problem, emit each editable file UNCHANGED — do not hallucinate.

Example output for an exercise with two files:

\`\`\`python path=solve.py
def solve(x):
    if x:
        return "ok"
    return ""
\`\`\`

\`\`\`python path=helpers.py
def helper():
    return 42
\`\`\`
`;

export function composeUserPrompt(instance: AiderInstance): string {
  const lines: string[] = [
    `Exercise: ${instance.instanceId}`,
    `Language: ${instance.language}`,
    '',
    'Problem statement:',
    instance.problemStatement,
    '',
    'Editable files (current content):',
  ];
  for (const [path, content] of Object.entries(instance.editableFiles)) {
    lines.push('', `--- ${path} ---`, content);
  }
  if (instance.contextFiles !== undefined && Object.keys(instance.contextFiles).length > 0) {
    lines.push('', 'Read-only context files (do NOT edit these — for reference only):');
    for (const [path, content] of Object.entries(instance.contextFiles)) {
      lines.push('', `--- ${path} (read-only) ---`, content);
    }
  }
  lines.push('', 'Produce the updated files now.');
  return lines.join('\n');
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
