const RETRYABLE_PATTERNS = [
  '请求过于频繁',
  '请求限频',
  '请稍后重试',
  'temporarily unavailable',
  'timeout',
  'timed out',
  'network',
  'connection',
  '连接',
  '超时'
]

const NON_RETRYABLE_PATTERNS = [
  'api key',
  '认证失败',
  '未配置',
  'json 格式不正确',
  'json格式不正确',
  '返回的 json 格式不正确',
  '返回的主分析 json 格式不正确'
]

function normalizeMessage(message) {
  return String(message || '').toLowerCase()
}

export function isRetryableAiError(message) {
  const normalized = normalizeMessage(message)

  if (!normalized) {
    return false
  }

  if (NON_RETRYABLE_PATTERNS.some(pattern => normalized.includes(pattern))) {
    return false
  }

  return RETRYABLE_PATTERNS.some(pattern => normalized.includes(pattern))
}

export function getRetryCooldownSeconds(message) {
  return isRetryableAiError(message) ? 8 : 0
}
