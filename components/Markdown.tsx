import { createElement, type ReactNode } from "react";

/**
 * Minimal, dependency-free Markdown renderer.
 *
 * Handles the subset the AI actually emits: headings, lists (nested), fenced
 * code blocks, inline code, bold/italic, links, blockquotes, rules and tables.
 * Input is treated as untrusted text — it is parsed into React elements and
 * never injected as raw HTML, so model output cannot execute markup.
 */

type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string }
  | { kind: "strong"; value: string }
  | { kind: "em"; value: string }
  | { kind: "del"; value: string }
  | { kind: "link"; value: string; href: string };

const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~]+~~)|(\[[^\]]*\]\([^)]+\))/;

function tokenizeInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let rest = input;

  while (rest.length > 0) {
    const match = INLINE_RE.exec(rest);
    if (!match || match.index === undefined) {
      tokens.push({ kind: "text", value: rest });
      break;
    }

    if (match.index > 0) {
      tokens.push({ kind: "text", value: rest.slice(0, match.index) });
    }

    const [full, code, strong, strongU, em, emU, del, link] = match;

    if (code) {
      tokens.push({ kind: "code", value: code.slice(1, -1) });
    } else if (strong) {
      tokens.push({ kind: "strong", value: strong.slice(2, -2) });
    } else if (strongU) {
      tokens.push({ kind: "strong", value: strongU.slice(2, -2) });
    } else if (em) {
      tokens.push({ kind: "em", value: em.slice(1, -1) });
    } else if (emU) {
      tokens.push({ kind: "em", value: emU.slice(1, -1) });
    } else if (del) {
      tokens.push({ kind: "del", value: del.slice(2, -2) });
    } else if (link) {
      const linkMatch = /\[([^\]]*)\]\(([^)]+)\)/.exec(link);
      if (linkMatch) {
        const href = linkMatch[2];
        const external = /^https?:\/\//i.test(href);
        tokens.push({ kind: "link", value: linkMatch[1], href });
        if (external) {
          // noop — rel/target applied at render time
        }
      }
    }

    rest = rest.slice(match.index + full.length);
  }

  return tokens;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return tokenizeInline(text).map((token, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (token.kind) {
      case "code":
        return <code key={key}>{token.value}</code>;
      case "strong":
        return <strong key={key}>{token.value}</strong>;
      case "em":
        return <em key={key}>{token.value}</em>;
      case "del":
        return <del key={key}>{token.value}</del>;
      case "link": {
        const external = /^https?:\/\//i.test(token.href);
        return (
          <a
            key={key}
            href={token.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {token.value}
          </a>
        );
      }
      default:
        return <span key={key}>{token.value}</span>;
    }
  });
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

const isTableDivider = (line: string) => /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(line);

export function Markdown({ content, className = "" }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const nextKey = () => `md-${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(
        <pre key={nextKey()}>
          <code data-lang={fence[1] || undefined}>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push(<hr key={nextKey()} />);
      i += 1;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 6);
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      out.push(createElement(Tag, { key: nextKey() }, renderInline(heading[2], String(key))));
      i += 1;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      out.push(
        <table key={nextKey()}>
          <thead>
            <tr>
              {header.map((cell, ci) => (
                <th key={ci}>{renderInline(cell, `th-${ci}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {header.map((_, ci) => (
                  <td key={ci}>{renderInline(row[ci] ?? "", `td-${ri}-${ci}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        body.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      out.push(
        <blockquote key={nextKey()}>{renderInline(body.join(" ").trim(), nextKey())}</blockquote>,
      );
      continue;
    }

    // Lists (ordered / unordered), with one level of nesting via indentation
    const bullet = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      const ordered = /\d/.test(bullet[2]);
      const baseIndent = bullet[1].length;

      const listItems: { depth: number; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) {
          // Continuation lines belonging to the previous item
          if (listItems.length && lines[i].trim() && /^\s{2,}/.test(lines[i])) {
            listItems[listItems.length - 1].text += ` ${lines[i].trim()}`;
            i += 1;
            continue;
          }
          break;
        }
        const indent = m[1].length;
        if (indent < baseIndent) break;
        if (indent > baseIndent + 1 && listItems.length === 0) break;
        listItems.push({ depth: indent > baseIndent ? 1 : 0, text: m[3] });
        i += 1;
      }

      const renderItems = (depth: number): ReactNode[] =>
        listItems
          .filter((item) => item.depth === depth)
          .map((item, idx) => {
            const nested = listItems.some((other) => other.depth > depth);
            const children: ReactNode[] = [
              <span key="t">{renderInline(item.text, `li-${depth}-${idx}`)}</span>,
            ];
            if (nested) {
              const deeper = Math.max(
                ...listItems.filter((o) => o.depth > depth).map((o) => o.depth),
              );
              children.push(renderItems(deeper));
            }
            return <li key={`li-${depth}-${idx}`}>{children}</li>;
          });

      const ListTag = ordered ? "ol" : "ul";
      out.push(createElement(ListTag, { key: nextKey() }, renderItems(0)));
      continue;
    }

    // Paragraph — consume until a blank line or a new block starts
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,6}\s|```|>|\s*([-*+]|\d+[.)])\s)/.test(lines[i]) &&
      !/^\s*([-*_])\s*(\1\s*){2,}$/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    if (para.length) {
      out.push(<p key={nextKey()}>{renderInline(para.join(" "), nextKey())}</p>);
    } else {
      i += 1;
    }
  }

  return <div className={`md ${className}`}>{out}</div>;
}
