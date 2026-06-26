const rateLimit = new Map();

function rateLimiter({ windowMs = 60000, max = 100, keyFn } = {}) {
  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip || 'unknown';
    const now = Date.now();
    let bucket = rateLimit.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      rateLimit.set(key, bucket);
    }
    bucket.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - bucket.count));
    if (bucket.count > max) {
      return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' });
    }
    next();
  };
}

const apiLimiter = rateLimiter({ windowMs: 60000, max: 120 });
const authLimiter = rateLimiter({ windowMs: 60000, max: 30, keyFn: (req) => `auth:${req.ip}` });

module.exports = { apiLimiter, authLimiter, rateLimiter };
