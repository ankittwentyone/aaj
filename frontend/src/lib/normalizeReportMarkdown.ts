/** Coerce LLM plain-text section numbers into markdown headings for ReactMarkdown. */
export function normalizeReportMarkdown(report: string): string {
  let s = (report ?? "").trim();
  if (!s) return s;

  // "1. Executive thesis" → ## Executive thesis
  s = s.replace(/^(\d+)\.\s+([A-Za-z][^\n]+)$/gm, (_, _n, title) => `## ${title.trim()}`);

  // Ensure top title
  if (!/^#\s/m.test(s)) {
    const firstLine = s.split("\n")[0];
    if (firstLine && !firstLine.startsWith("#")) {
      s = `# ${firstLine}\n\n${s.slice(firstLine.length).trim()}`;
    }
  }

  return s;
}
