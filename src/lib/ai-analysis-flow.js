const TRUE_VALUES = new Set(['true', '1', 'yes', 'on'])

const hasCachedReview = (analysis) => {
  return Boolean(analysis?.aiReview)
}

const hasCachedCoaching = (payload) => {
  return Boolean(payload?.aiCoachingSummary && payload?.aiCoachingSuggestions?.length)
}

export const getStoredAutoAiPreference = (rawValue) => {
  if (typeof rawValue !== 'string') {
    return false
  }

  return TRUE_VALUES.has(rawValue.trim().toLowerCase())
}

export const shouldAutoGenerateAiReview = (enabled, analysis) => {
  if (!enabled) {
    return false
  }

  return !hasCachedReview(analysis)
}

export const getAiReviewState = (analysis) => {
  return hasCachedReview(analysis) ? 'cached' : 'idle'
}

export const getAiCoachingState = (payload) => {
  return hasCachedCoaching(payload) ? 'cached' : 'idle'
}
