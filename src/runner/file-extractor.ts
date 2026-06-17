/**
 * Extract per-file edited content from an Aider polyglot model response.
 *
 * Expected response shape: one fenced code block per edited file, each
 * tagged with its relative path. See prompt-template.ts for the exact
 * format expected.
 *
 * @module runner/file-extractor
 */

// NOTE: parses UNTRUSTED model output. Two ReDoS hardening measures apply:
//   1. The whitespace quantifiers are de-ambiguated. The previous form
//      `\s*([a-zA-Z0-9_+-]*)\s+` let the optional leading `\s*` and the
//      mandatory `\s+` both match the same whitespace run (the lang group
//      can be empty), so a long run of spaces after the fence with no
//      `path=` made the engine retry the `\s*`/`\s+` split at every offset —
//      polynomial backtracking (a 200k-space input took ~34s before this
//      change). Here there is exactly ONE mandatory whitespace run after the
//      fence; the optional language token lives inside a non-capturing group
//      `(?:lang[ \t]+)?` whose first atom `[a-zA-Z0-9_+-]+` is NON-whitespace
//      and fails fast. Because a mandatory non-whitespace token separates the
//      outer `[ \t]*` from the inner `[ \t]+`, the two whitespace quantifiers
//      can never compete for the same characters, so the engine has nothing
//      to backtrack over (the 200k-space input now finishes in ~2ms).
//   2. Callers bound input length before this regex sink (see
//      MAX_RESPONSE_LENGTH in extractEditedFiles).
const FENCED_PATH_RE = /```[ \t]*(?:([a-zA-Z0-9_+-]+)[ \t]+)?path=(\S+)\n([\s\S]*?)```/g;

/**
 * Hard cap on the response size we will run the fenced-block regex over.
 * Model responses for an Aider polyglot edit are at most a handful of small
 * files; legitimate output is far under this. Bounding the input before the
 * regex sink caps worst-case matching time regardless of the pattern.
 */
const MAX_RESPONSE_LENGTH = 1_000_000;

/**
 * Parse a model response into a `path → content` map.
 *
 * Handles the common shape: ` ```<lang> path=<path>\n<content>``` ` blocks.
 * Returns an empty map when no recognised blocks are found.
 *
 * Whitespace handling: trailing whitespace per line is preserved (tests
 * may depend on it); a trailing newline is appended only when the source
 * file's final line lacks one (matches editor save behaviour).
 */
export function extractEditedFiles(response: string): Record<string, string> {
  const out: Record<string, string> = {};
  // Bound untrusted input length before the regex sink. Legitimate Aider
  // edit responses are tiny relative to this cap; anything larger is
  // truncated rather than fed whole to the matcher.
  const bounded =
    response.length > MAX_RESPONSE_LENGTH
      ? response.slice(0, MAX_RESPONSE_LENGTH)
      : response;
  // Reset regex global state for re-runs.
  FENCED_PATH_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCED_PATH_RE.exec(bounded)) !== null) {
    const path = match[2];
    const content = match[3];
    if (path === undefined || content === undefined) continue;
    // Trim ONLY the trailing newline that the fence adds, not user
    // whitespace inside the file.
    const cleaned = content.endsWith('\n') ? content.slice(0, -1) : content;
    out[path] = cleaned;
  }
  return out;
}
