// Safe renderer for Smart Assistant message content.
// Model output is UNTRUSTED. This module converts it to a small, fixed set of
// React nodes: everything is escaped by construction (React text nodes), and
// only a restricted markdown subset is honoured (bold, italic, inline code,
// bullet lists, numbered lists, paragraphs). No raw HTML, no links, no images,
// no script vectors. Used by the chat UI (slice 8).

import React from 'react';

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const ulMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ulMatch) {
      if (current?.kind !== 'ul') {
        flush();
        current = { kind: 'ul', items: [] };
      }
      (current as { kind: 'ul'; items: string[] }).items.push(ulMatch[1]);
    } else if (olMatch) {
      if (current?.kind !== 'ol') {
        flush();
        current = { kind: 'ol', items: [] };
      }
      (current as { kind: 'ol'; items: string[] }).items.push(olMatch[1]);
    } else {
      if (current?.kind !== 'p') {
        flush();
        current = { kind: 'p', lines: [] };
      }
      (current as { kind: 'p'; lines: string[] }).lines.push(line);
    }
  }
  flush();
  return blocks;
}

/** Inline formatting: **bold**, *italic*, `code`. Returns React nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    const key = `${keyPrefix}-i${i++}`;
    if (token.startsWith('**')) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function SafeMessage({ content }: { content: string }) {
  const blocks = parseBlocks(content.slice(0, 10000));
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-800">
      {blocks.map((block, bi) => {
        if (block.kind === 'ul') {
          return (
            <ul key={bi} className="list-disc pl-5 space-y-1">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `${bi}-${ii}`)}</li>
              ))}
            </ul>
          );
        }
        if (block.kind === 'ol') {
          return (
            <ol key={bi} className="list-decimal pl-5 space-y-1">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item, `${bi}-${ii}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {renderInline(block.lines.join('\n'), `${bi}`)}
          </p>
        );
      })}
    </div>
  );
}
