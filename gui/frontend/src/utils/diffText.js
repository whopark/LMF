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

// H3: Iterative traceback (replaced recursive version to prevent stack overflow
// on long description texts). Builds result array in reverse, then reverses once.
function traceback(dp, a, b) {
  const result = [];
  let i = a.length;
  let j = b.length;

  while (i > 0 || j > 0) {
    if (i === 0) {
      result.push({ text: b[j - 1], type: 'added' });
      j--;
    } else if (j === 0) {
      result.push({ text: a[i - 1], type: 'removed' });
      i--;
    } else if (a[i - 1] === b[j - 1]) {
      result.push({ text: a[i - 1], type: 'same' });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      result.push({ text: a[i - 1], type: 'removed' });
      i--;
    } else {
      result.push({ text: b[j - 1], type: 'added' });
      j--;
    }
  }

  return result.reverse();
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

  const dp = buildLCS(a, b);
  return traceback(dp, a, b);
}
