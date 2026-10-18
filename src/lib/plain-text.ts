/**
 * Turn rich text HTML from the admin editor into plain text, for places that
 * can't show formatting: search and link-preview descriptions, and the
 * structured data search engines read.
 *
 * With maxLength, long text is cut at a word break and ends with "…".
 */
export function toPlainText(html: string | null | undefined, maxLength?: number): string {
  if (!html) return "";

  const text = html
    // Keep a space where a paragraph, heading, list item or line break ended.
    .replace(/<(br\s*\/?|\/p|\/h[1-6]|\/li|\/blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  if (!maxLength || text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:]+$/, "")}…`;
}
