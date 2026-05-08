import React from 'react';

/**
 * Returns CSS class based on item type
 */
export function getTagClass(type) {
  if (!type) return '';
  if (type.includes('핵심')) return 'type-core';
  if (type.includes('기본')) return 'type-basic';
  return 'type-required';
}

/**
 * Formats description text into paragraphs (general text without bullets)
 */
export function formatDescription(desc) {
  if (!desc) return null;
  const rawLines = desc.split('\n').map(l => l.trim()).filter(l => l);
  const processedLines = [];
  let current = "";
  rawLines.forEach(line => {
    current += line;
    if (/[.?!]$/.test(line) || line.startsWith('•') || line.startsWith('-')) {
      processedLines.push(current.replace(/^[•\-\*]\s*/, ''));
      current = "";
    }
  });
  if (current) processedLines.push(current.replace(/^[•\-\*]\s*/, ''));
  return processedLines.map((line, idx) => <p key={idx} style={{ margin: '0.3rem 0' }}>{line}</p>);
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
