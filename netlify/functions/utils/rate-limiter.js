// 简单的内存缓存用于限流（生产环境建议使用 Redis）
const rateLimitCache = new Map();

class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  checkRateLimit(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // 清理过期记录
    for (const [key, data] of rateLimitCache.entries()) {
      if (data.lastRequest < windowStart) {
        rateLimitCache.delete(key);
      }
    }

    const clientData = rateLimitCache.get(identifier) || {
      count: 0,
      lastRequest: now
    };

    // 检查是否超过限制
    if (clientData.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(clientData.lastRequest + this.windowMs)
      };
    }

    // 更新计数
    clientData.count++;
    clientData.lastRequest = now;
    rateLimitCache.set(identifier, clientData);

    return {
      allowed: true,
      remaining: this.maxRequests - clientData.count,
      resetTime: new Date(now + this.windowMs)
    };
  }
}

// 创建限流器实例：每分钟 60 次请求
const rateLimiter = new RateLimiter(60, 60 * 1000);

module.exports = { rateLimiter };
