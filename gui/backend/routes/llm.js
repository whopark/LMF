const express = require('express');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk').default;
const { logRateLimitExceeded } = require('../utils/securityLogger');

const router = express.Router();

const client = new Anthropic();

const LLM_MODEL = process.env.LLM_MODEL || 'claude-haiku-4-5';
const LLM_MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS, 10) || 300;
const LLM_RATE_LIMIT = parseInt(process.env.LLM_RATE_LIMIT_PER_MIN, 10) || 20;

const reasonLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: LLM_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment.' },
  handler: (req, res) => {
    logRateLimitExceeded(req);
    res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  },
});

// Generate modification reason using Claude
router.post('/reason', reasonLimiter, async (req, res) => {
  try {
    const { previous, current, changeType, summary } = req.body;

    if (!previous && !current) {
      return res.status(400).json({ error: 'previous or current data required' });
    }

    const prompt = buildPrompt(previous, current, changeType, summary);

    const response = await client.messages.create({
      model: LLM_MODEL,
      max_tokens: LLM_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const reason = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    res.json({ reason });
  } catch (err) {
    console.error('LLM reason generation failed:', err.message);
    res.status(500).json({ error: 'Failed to generate reason' });
  }
});

function buildPrompt(prev, curr, changeType, summary) {
  // Build context based on change type
  const context = changeType === 'NEW'
    ? `신규 문항이 추가되었습니다.\n현재: ${JSON.stringify(curr)}`
    : changeType === 'DELETED'
      ? `기존 문항이 삭제되었습니다.\n이전: ${JSON.stringify(prev)}`
      : `이전 버전:\n${JSON.stringify(prev)}\n\n현재 버전:\n${JSON.stringify(curr)}`;

  return `당신은 우수검사실 신임인증 심사점검표의 변경사항을 분석하는 전문가입니다.

아래 두 버전의 심사 문항을 비교하고, 변경된 이유를 한국어로 간결하게 1~2문장으로 작성하세요.
변경 유형: ${changeType} (${summary})

${context}

수정사유:`;
}

module.exports = router;
