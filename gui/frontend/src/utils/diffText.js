// Word-level diff using LCS (Longest Common Subsequence).
// Returns [{text: string, type: 'same' | 'added' | 'removed'}]

function tokenize(text) {
  if (!text) return [];
  return text.split(/\s+/).filter(Boolean);
}

// Build LCS length table for two token arrays.
function buildLCS(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

// Trace back through the LCS table to extract diff tokens.
function traceback(dp, a, b, i, j) {
  if (i === 0 && j === 0) return [];
  if (i === 0) {
    return [...traceback(dp, a, b, 0, j - 1), { text: b[j - 1], type: 'added' }];
  }
  if (j === 0) {
    return [...traceback(dp, a, b, i - 1, 0), { text: a[i - 1], type: 'removed' }];
  }
  if (a[i - 1] === b[j - 1]) {
    return [...traceback(dp, a, b, i - 1, j - 1), { text: a[i - 1], type: 'same' }];
  }
  if (dp[i - 1][j] >= dp[i][j - 1]) {
    return [...traceback(dp, a, b, i - 1, j), { text: a[i - 1], type: 'removed' }];
  }
  return [...traceback(dp, a, b, i, j - 1), { text: b[j - 1], type: 'added' }];
}

/**
 * Compute word-level diff between two strings.
 * @param {string} oldText
 * @param {string} newText
 * @returns {{ text: string, type: 'same'|'added'|'removed' }[]}
 */
export function diffWords(oldText, newText) {
  const a = tokenize(oldText);
  const b = tokenize(newText);
  if (a.length === 0 && b.length === 0) return [];

  // Iterative traceback to avoid stack overflow on long texts
  const dp = buildLCS(a, b);
  return traceback(dp, a, b, a.length, b.length);
}
