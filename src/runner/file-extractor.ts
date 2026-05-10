/**
 * Extract per-file edited content from an Aider polyglot model response.
 *
 * Expected response shape: one fenced code block per edited file, each
 * tagged with its relative path. See prompt-template.ts for the exact
 * format expected.
 *
 * @module runner/file-extractor
 */

const FENCED_PATH_RE = /```\s*([a-zA-Z0-9_+-]*)\s+path=(\S+?)\n([\s\S]*?)```/g;

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
  // Reset regex global state for re-runs.
  FENCED_PATH_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCED_PATH_RE.exec(response)) !== null) {
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
