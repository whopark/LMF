import React from 'react';
import { diffWords } from '../utils/diffText.js';

/**
 * Renders inline word-level diff between oldText and newText.
 * - removed words: red background + strikethrough
 * - added words: green background
 * - unchanged: plain
 */
function DiffText({ oldText, newText }) {
  if (!oldText && !newText) return null;

  // If only one side exists, show it directly
  if (!oldText) return <span className="diff-added">{newText}</span>;
  if (!newText) return <span className="diff-removed" style={{ textDecoration: 'line-through' }}>{oldText}</span>;

  const tokens = diffWords(oldText, newText);

  return (
    <span className="diff-text">
      {tokens.map((token, idx) => (
        <span
          key={idx}
          className={`diff-token diff-${token.type}`}
          style={token.type === 'removed' ? { textDecoration: 'line-through' } : undefined}
        >
          {token.text}{' '}
        </span>
      ))}
    </span>
  );
}

export default DiffText;
