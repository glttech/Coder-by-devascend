export interface ParsedTranscript {
  summary: string;        // first non-blank paragraph or up to 200 chars
  filesChanged: string[]; // lines matching file path patterns
  commandsRun: string[];  // lines starting with $ or > or inside code blocks
  risksDetected: string[]; // lines containing risk keywords
  suggestedTitle: string; // up to 80 chars from summary
}

// Matches common source/config file extensions.
// Order matters: tsx/jsx must come before ts/js so the longer suffix wins.
const FILE_PATH_RE = /[a-zA-Z0-9_\-./]+\.(tsx|jsx|ts|js|py|go|rs|sql|prisma|json|yaml|yml|md|sh|env)/g;

// Shell-like command keywords that indicate a code block is a shell block
const SHELL_KEYWORDS = ['npm', 'git', 'curl', 'cd', 'mkdir', 'rm', 'cp', 'mv'];

const RISK_KEYWORDS = [
  'delete',
  'drop table',
  'rm -rf',
  '--force',
  'migration',
  'production',
  'env',
  '.env',
  'secret',
  'password',
  'token',
  'api key',
];

/**
 * Split raw transcript into segments: either triple-backtick code blocks or
 * plain-text segments. Each segment carries a flag indicating if it's a code block.
 */
interface Segment {
  text: string;
  isCodeBlock: boolean;
  language: string; // the fence language hint, if any
}

function splitSegments(raw: string): Segment[] {
  const segments: Segment[] = [];
  // Split on triple-backtick fences
  const parts = raw.split(/(```[^\n]*\n[\s\S]*?```)/g);
  for (const part of parts) {
    if (part.startsWith('```')) {
      // Extract language hint from opening fence
      const firstNewline = part.indexOf('\n');
      const lang = part.slice(3, firstNewline).trim().toLowerCase();
      const content = part.slice(firstNewline + 1, part.lastIndexOf('```'));
      segments.push({ text: content, isCodeBlock: true, language: lang });
    } else {
      segments.push({ text: part, isCodeBlock: false, language: '' });
    }
  }
  return segments;
}

/**
 * Strip inline backtick spans from a line so file-path detection is not
 * triggered by paths inside `inline code`.
 */
function stripInlineCode(line: string): string {
  return line.replace(/`[^`]*`/g, '');
}

function isShellBlock(segment: Segment): boolean {
  if (['sh', 'bash', 'shell', 'zsh', 'fish', 'console', 'terminal'].includes(segment.language)) {
    return true;
  }
  // Heuristic: block contains shell keywords
  return SHELL_KEYWORDS.some((kw) => segment.text.includes(kw));
}

function deduplicateOrdered(items: string[]): string[] {
  return [...new Set(items)];
}

export function parseTranscript(raw: string): ParsedTranscript {
  if (!raw || raw.trim().length === 0) {
    return {
      summary: '',
      filesChanged: [],
      commandsRun: [],
      risksDetected: [],
      suggestedTitle: '',
    };
  }

  const segments = splitSegments(raw);

  const filesSet: string[] = [];
  const commandsSet: string[] = [];
  const risksSet: string[] = [];

  for (const segment of segments) {
    if (segment.isCodeBlock) {
      // --- Code block processing ---
      if (isShellBlock(segment)) {
        // Every non-blank line in a shell block is a command
        for (const line of segment.text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) commandsSet.push(trimmed);
        }
      }
      // Do NOT extract file paths from code blocks
    } else {
      // --- Plain-text processing ---
      for (const line of segment.text.split('\n')) {
        const stripped = stripInlineCode(line);
        const trimmedLine = line.trim();

        // Command detection: lines starting with $, >, or %
        if (/^[$>%]\s/.test(trimmedLine)) {
          commandsSet.push(trimmedLine);
        }

        // File path detection (on line with inline code removed)
        const matches = stripped.match(FILE_PATH_RE);
        if (matches) {
          for (const m of matches) {
            filesSet.push(m);
          }
        }

        // Risk detection (case-insensitive, on original line)
        const lower = line.toLowerCase();
        for (const kw of RISK_KEYWORDS) {
          if (lower.includes(kw)) {
            risksSet.push(trimmedLine || line);
            break; // only add the line once even if multiple keywords match
          }
        }
      }
    }
  }

  // --- Summary: first non-blank, non-code-block paragraph ---
  let summary = '';
  for (const segment of segments) {
    if (segment.isCodeBlock) continue;
    // Find the first paragraph (split by blank lines)
    const paragraphs = segment.text.split(/\n\s*\n/);
    for (const para of paragraphs) {
      const cleaned = para.trim();
      if (cleaned.length > 0) {
        summary = cleaned.slice(0, 200);
        break;
      }
    }
    if (summary) break;
  }

  // Suggested title: first sentence of summary, up to 80 chars
  let suggestedTitle = '';
  if (summary) {
    // Split on sentence-ending punctuation followed by whitespace or end
    const sentenceMatch = summary.match(/^[^.!?\n]+[.!?]?/);
    const firstSentence = sentenceMatch ? sentenceMatch[0].trim() : summary;
    suggestedTitle = firstSentence.slice(0, 80);
  }

  return {
    summary,
    filesChanged: deduplicateOrdered(filesSet),
    commandsRun: deduplicateOrdered(commandsSet),
    risksDetected: deduplicateOrdered(risksSet),
    suggestedTitle,
  };
}
