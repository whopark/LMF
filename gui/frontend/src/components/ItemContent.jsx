import React from 'react';

const CLASSIFICATION_LABEL = { C: '핵심', R: '필요', B: '기본' };
const CLASSIFICATION_CLASS = { C: 'badge-core', R: 'badge-required', B: 'badge-basic' };

/**
 * Renders formatted item content: classification badge, item_number,
 * question, description with bullet point support.
 * score display: null → '핵심', number → 'N점'
 */
function ItemContent({ item }) {
  if (!item) return null;

  const { about_item: ai, revision } = item;
  const cls = ai?.item_type || '';
  const score = ai?.score;
  const isCore = cls === 'C' || score === null;

  return (
    <div className="item-content-wrapper">
      <div className="item-main-header">
        {revision?.revised && (
          <span className="badge-revised">REVISED</span>
        )}
        {cls && CLASSIFICATION_LABEL[cls] && (
          <span className={CLASSIFICATION_CLASS[cls] || 'badge-required'}>
            {CLASSIFICATION_LABEL[cls]}
          </span>
        )}
        <span className="item-number">{ai?.item_number}</span>
        <span className="item-question">{ai?.question}</span>
      </div>

      {ai?.description && (
        <div className="item-description">
          <BulletDescription text={ai.description} />
        </div>
      )}

      <div className="item-score">
        {isCore ? (
          <span className="score-core">핵심</span>
        ) : (
          <span className="score-value">{score}점</span>
        )}
      </div>
    </div>
  );
}

/**
 * Renders description text handling ∙ bullet points and line breaks.
 */
function BulletDescription({ text }) {
  if (!text) return null;

  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  return (
    <ul className="description-list">
      {lines.map((line, idx) => {
        const content = line.replace(/^[∙•\-]\s*/, '');
        return (
          <li key={idx} className="description-item">{content}</li>
        );
      })}
    </ul>
  );
}

export default ItemContent;
