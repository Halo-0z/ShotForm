import test from "node:test"
import assert from "node:assert/strict"

import { getRetryCooldownSeconds, isRetryableAiError } from "./ai-retry-policy.js"

test("treats rate limit errors as retryable", () => {
    assert.equal(isRetryableAiError("混元服务当前请求过于频繁 [hy3-preview]，请稍后重试。"), true)
})

test("does not treat API key errors as retryable", () => {
    assert.equal(isRetryableAiError("混元 API 认证失败，请检查 HUNYUAN_API_KEY 是否正确。"), false)
})

test("uses a short cooldown for retryable errors", () => {
    assert.equal(getRetryCooldownSeconds("混元服务当前请求过于频繁 [hy3-preview]，请稍后重试。"), 8)
})
