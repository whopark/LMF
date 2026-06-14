import React from 'react';

/**
 * Returns CSS class based on item type / classification code
 */
export function getTagClass(type) {
  if (!type) return '';
  if (type === 'C' || type.includes('핵심')) return 'type-core';
  if (type === 'B' || type.includes('기본')) return 'type-basic';
  return 'type-required';
}

/**
 * Formats score for display.
 * null score or C classification → '핵심 (필수)'
 * numeric → 'N점'
 */
export function formatScore(score, classification) {
  if (score === null || score === undefined || classification === 'C') {
    return '핵심 (필수)';
  }
  return `${score}점`;
}

const BULLET_RE = /^[∙•\-\*]\s*/;

/**
 * Formats description text, rendering ∙ lines as <li> and plain text as <p>.
 * Groups consecutive bullet lines into a single <ul> block.
 */
export function formatDescription(desc) {
  if (!desc) return null;
  const rawLines = desc.split('\n').map(l => l.trim()).filter(l => l);
  const elements = [];
  let bulletGroup = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    elements.push(
      <ul key={key++} style={{ margin: '0.3rem 0 0.3rem 1.2rem', padding: 0 }}>
        {bulletGroup.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    );
    bulletGroup = [];
  };

  rawLines.forEach(line => {
    if (BULLET_RE.test(line)) {
      bulletGroup.push(line.replace(BULLET_RE, ''));
    } else {
      flushBullets();
      elements.push(<p key={key++} style={{ margin: '0.3rem 0' }}>{line}</p>);
    }
  });
  flushBullets();
  return elements.length > 0 ? elements : null;
}

/**
 * Renders structured blocks (text / bullet / table) from Item.blocks array.
 * Falls back to formatDescription when blocks is empty.
 */
export function formatBlocks(blocks, fallbackDesc) {
  if (!blocks || blocks.length === 0) return formatDescription(fallbackDesc);
  return blocks.map((block, idx) => {
    if (block.type === 'bullet') {
      const items = Array.isArray(block.content) ? block.content : [block.content];
      return (
        <ul key={idx} style={{ margin: '0.3rem 0 0.3rem 1.2rem', padding: 0 }}>
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    }
    if (block.type === 'heading') {
      return <h4 key={idx} style={{ margin: '0.5rem 0 0.2rem', fontSize: '0.9rem', fontWeight: 600, color: '#cbd5e1' }}>{block.content}</h4>;
    }
    if (block.type === 'note') {
      return <p key={idx} style={{ margin: '0.3rem 0', padding: '0.2rem 0.4rem', borderLeft: '3px solid #f59e0b', fontSize: '0.85rem', color: '#94a3b8' }}>※ {block.content}</p>;
    }
    if (block.type === 'table') {
      const rows = Array.isArray(block.content) ? block.content : [];
      return (
        <table key={idx} style={{ borderCollapse: 'collapse', margin: '0.5rem 0', fontSize: '0.85rem', width: '100%' }}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {(Array.isArray(row) ? row : [row]).map((cell, c) => (
                  <td key={c} style={{ border: '1px solid #4b5563', padding: '3px 6px' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    // type === 'text' or unknown
    const text = typeof block.content === 'string' ? block.content : String(block.content || '');
    return <p key={idx} style={{ margin: '0.3rem 0' }}>{text}</p>;
  });
}

/**
 * Extracts display data from item, handling merged extraction
 */
export function getDisplayData(item) {
  if (!item) return { question: '', description: '' };
  let q = item.about_item.question;
  let d = item.about_item.description;

  // Fix for merged extraction (mostly 2020)
  if (!d && q && q.includes('?')) {
    const idx = q.indexOf('?');
    d = q.substring(idx + 1).trim();
    q = q.substring(0, idx + 1);
  }
  return { question: q, description: d };
}

// API Base URL: uses VITE_API_URL in production, falls back to /api for dev proxy
export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';
