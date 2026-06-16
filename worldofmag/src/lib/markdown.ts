export function markdownToHtml(md: string): string {
  // Escape "&" and "<" outside code blocks up-front — that is what neutralises
  // HTML injection (a lone ">" cannot open a tag, so it is left intact). Keeping
  // ">" un-escaped is the whole point: the blockquote pass below matches "> ",
  // which a global ">" → "&gt;" escape used to destroy before it ran.
  let html = escapeOutsideCodeBlocks(md);

  // ── Code blocks (``` ... ```) — must come before inline code ──────────────
  // Code content is raw here (escapeOutsideCodeBlocks skips it), so escape it
  // fully (including ">") for faithful display.
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-pre"><code class="md-code-block${lang ? ` language-${lang}` : ""}">${escapeHtml(code)}</code></pre>`;
  });

  // ── Tables ────────────────────────────────────────────────────────────────
  html = html.replace(/((?:\|.+\|\n?)+)/g, (block) => {
    const rows = block.trim().split("\n").filter((r) => r.trim());
    if (rows.length < 2) return block;
    const isSeparator = (row: string) => /^\|[\s|:-]+\|$/.test(row.trim());

    const headers = rows[0].split("|").slice(1, -1).map((c) => c.trim());
    const dataRows = rows.slice(isSeparator(rows[1]) ? 2 : 1);

    const thead = `<thead><tr>${headers.map((h) => `<th class="md-th">${inlineFormat(h)}</th>`).join("")}</tr></thead>`;
    const tbody = `<tbody>${dataRows
      .map((row) => {
        const cells = row.split("|").slice(1, -1).map((c) => c.trim());
        return `<tr>${cells.map((c) => `<td class="md-td">${inlineFormat(c)}</td>`).join("")}</tr>`;
      })
      .join("")}</tbody>`;

    return `<table class="md-table">${thead}${tbody}</table>`;
  });

  // ── Headings (h1–h6; longest prefix first so #### isn't caught by ###) ──────
  html = html.replace(/^###### (.+)$/gm, (_, t) => `<h6 class="md-h6">${inlineFormat(t)}</h6>`);
  html = html.replace(/^##### (.+)$/gm, (_, t) => `<h5 class="md-h5">${inlineFormat(t)}</h5>`);
  html = html.replace(/^#### (.+)$/gm, (_, t) => `<h4 class="md-h4">${inlineFormat(t)}</h4>`);
  html = html.replace(/^### (.+)$/gm, (_, t) => `<h3 class="md-h3">${inlineFormat(t)}</h3>`);
  html = html.replace(/^## (.+)$/gm, (_, t) => `<h2 class="md-h2">${inlineFormat(t)}</h2>`);
  html = html.replace(/^# (.+)$/gm, (_, t) => `<h1 class="md-h1">${inlineFormat(t)}</h1>`);

  // ── Horizontal rules ──────────────────────────────────────────────────────
  html = html.replace(/^---+$/gm, '<hr class="md-hr" />');

  // ── Blockquote (> text) — consecutive lines collapse into one block ─────────
  html = html.replace(/((?:^> .+\n?)+)/gm, (block) => {
    const lines = block.trim().split("\n").map((line) => inlineFormat(line.replace(/^> /, "")));
    return `<blockquote class="md-blockquote">${lines.join("<br />")}</blockquote>`;
  });

  // ── Ordered lists (1. 2. 3. …) — must come before unordered ─────────────────
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
    const items = block.replace(/\n+$/, "").split("\n").map((line) => {
      const text = line.replace(/^\d+\. /, "");
      return `<li class="md-oli">${inlineFormat(text)}</li>`;
    }).join("");
    return `<ol class="md-ol">${items}</ol>`;
  });

  // ── Unordered lists (nesting via indentation: 2 spaces = 1 level) ──────────
  html = html.replace(/((?:^[ \t]*[-*] .+\n?)+)/gm, (block) => {
    const items = block.replace(/\n+$/, "").split("\n").map((line) => {
      const m = /^([ \t]*)[-*] (.*)$/.exec(line);
      if (!m) return "";
      const depth = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
      const pad = depth > 0 ? ` style="margin-left:${depth * 1.1}rem"` : "";
      return `<li class="md-li"${pad}>${inlineFormat(m[2])}</li>`;
    }).join("");
    return `<ul class="md-ul">${items}</ul>`;
  });

  // ── Paragraphs (blank-line separated, skip already wrapped elements) ───────
  const blocks = html.split(/\n{2,}/);
  html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|ul|ol|pre|table|hr|blockquote)/.test(trimmed)) return trimmed;
      return `<p class="md-p">${inlineFormat(trimmed.replace(/\n/g, " "))}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  return html;
}

function inlineFormat(text: string): string {
  // Text reaching here has already been escaped (globally for prose, or via
  // escapeHtml for code-derived cells), so only the inline Markdown transforms
  // run — their generated tags must survive.
  return text
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Obrazy (![alt](url)) — PRZED linkami, by nie złapała ich reguła linku.
    // Tekst jest już zescapowany (&,<), dopuszczamy tylko http(s) i escapujemy " w atrybutach.
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt: string, url: string) =>
      /^https?:\/\//i.test(url)
        ? `<img class="md-img" src="${url.replace(/"/g, "%22")}" alt="${alt.replace(/"/g, "&quot;")}" loading="lazy" referrerpolicy="no-referrer" />`
        : m
    )
    // Linki: tylko bezpieczne schematy (http(s) / relatywne „/" / kotwica „#" / mailto).
    // Blokuje javascript:/data: itp. (XSS po kliknięciu). Escapujemy " w href, by nie
    // dało się wyjść z atrybutu. Tekst etykiety jest już zescapowany wcześniej.
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label: string, url: string) =>
      /^(https?:\/\/|\/|#|mailto:)/i.test(url.trim())
        ? `<a class="md-link" href="${url.trim().replace(/"/g, "%22")}">${label}</a>`
        : m
    );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeOutsideCodeBlocks(md: string): string {
  const parts = md.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // inside a fenced code block — left raw, escaped later
      // Escape "&" and "<" only; ">" stays so block markers like "> " survive.
      return part.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    })
    .join("");
}

export const MARKDOWN_STYLES = `
.md-h1 { font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin: 1.5rem 0 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
.md-h2 { font-size: 1.15rem; font-weight: 600; color: var(--text-primary); margin: 1.5rem 0 0.5rem; }
.md-h3 { font-size: 1rem; font-weight: 600; color: var(--text-secondary); margin: 1.25rem 0 0.4rem; }
.md-h4 { font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); margin: 1rem 0 0.3rem; }
.md-h5 { font-size: 0.875rem; font-weight: 600; color: var(--text-muted); margin: 0.9rem 0 0.3rem; }
.md-h6 { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin: 0.85rem 0 0.3rem; text-transform: uppercase; letter-spacing: 0.03em; }
.md-p  { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.75; margin: 0.5rem 0; }
.md-hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
.md-ul { list-style: none; padding: 0; margin: 0.5rem 0 0.75rem 0; }
.md-ol { list-style: decimal; padding-left: 1.4rem; margin: 0.5rem 0 0.75rem 0; }
.md-oli { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.7; margin-left: 0.2rem; }
.md-li { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.7; padding-left: 1rem; position: relative; }
.md-li::before { content: "•"; position: absolute; left: 0; color: var(--text-muted); }
.md-ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0 0.75rem 0; }
.md-oli { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.7; padding-left: 0.25rem; }
.md-code { font-family: monospace; font-size: 0.8em; background: var(--bg-elevated); color: var(--accent-blue); padding: 1px 5px; border-radius: 3px; border: 1px solid var(--border); }
.md-pre  { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 0.75rem 0; }
.md-code-block { font-family: monospace; font-size: 0.78rem; color: var(--text-secondary); line-height: 1.65; display: block; white-space: pre; }
.md-table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; font-size: 0.8rem; }
.md-th { text-align: left; padding: 7px 12px; background: var(--bg-elevated); color: var(--text-muted); font-weight: 600; border: 1px solid var(--border); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
.md-td { padding: 7px 12px; border: 1px solid var(--border); color: var(--text-secondary); vertical-align: top; }
.md-link { color: var(--accent-blue); text-decoration: underline; }
.md-img { max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--border); margin: 0.5rem 0; display: block; }
.md-blockquote { border-left: 3px solid var(--accent-purple); padding-left: 12px; margin: 0.5rem 0; color: var(--text-muted); font-style: italic; font-size: 0.875rem; }
strong { color: var(--text-primary); font-weight: 600; }
`;
