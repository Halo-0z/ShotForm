use crate::models::{
    AiAnalysisPayload, AiCoachingResponse, AiShotReview, CorrectionSuggestion, ShotType,
};
use serde::{Deserialize, Serialize};
const DEFAULT_BASE_URL: &str = "https://api.hunyuan.cloud.tencent.com/v1";
const DEFAULT_MODEL: &str = "hunyuan-turbos-latest";
const DEFAULT_VISION_MODEL: &str = "hunyuan-turbos-vision-20250619";
pub async fn generate_shot_review(
    payload: &AiAnalysisPayload,
    image_data: Option<&str>,
) -> Result<AiShotReview, String> {
    let content = send_chat_completion(
        payload,
        image_data,
        0.2,
        1100,
        build_shot_review_system_prompt(),
        build_shot_review_user_prompt(payload),
    )
    .await?;
    parse_shot_review_response(&content)
}
pub async fn generate_correction_suggestions(
    payload: &AiAnalysisPayload,
    image_data: Option<&str>,
) -> Result<AiCoachingResponse, String> {
    let content = send_chat_completion(
        payload,
        image_data,
        0.45,
        1400,
        build_coaching_system_prompt(),
        build_coaching_user_prompt(payload),
    )
    .await?;
    parse_coaching_response(&content)
}
async fn send_chat_completion(
    payload: &AiAnalysisPayload,
    image_data: Option<&str>,
    temperature: f32,
    max_tokens: u32,
    system_prompt: &str,
    user_prompt: String,
) -> Result<String, String> {
    let api_key = read_env(["HUNYUAN_API_KEY", "TENCENT_HUNYUAN_API_KEY"])?;
    let base_url =
        std::env::var("HUNYUAN_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
    let client = reqwest::Client::new();
    let models = resolve_candidate_models(image_data.is_some());
    let mut last_error = String::new();
    for model in models {
        let request = ChatCompletionsRequest {
            model: model.clone(),
            temperature,
            max_tokens,
            messages: build_messages(
                system_prompt,
                user_prompt.clone(),
                payload,
                image_data,
                &model,
            ),
        };
        let response = client
            .post(format!("{base_url}/chat/completions"))
            .bearer_auth(&api_key)
            .json(&request)
            .send()
            .await;
        let response = match response {
            Ok(response) => response,
            Err(error) => {
                last_error = format!("\u{8c03}\u{7528}\u{6df7}\u{5143} API \u{5931}\u{8d25}: {error}");
                continue;
            }
        };
        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "failed to read error body".to_string());
            let kind = classify_api_error(status, &body);
            eprintln!("Hunyuan API error ({status}) [{model}]: {body}");
            last_error = format_api_error_message(&model, status, &body);
            if !should_try_next_model(&kind) {
                return Err(last_error);
            }
            continue;
        }
        let response_body: ChatCompletionsResponse = response
            .json()
            .await
            .map_err(|error| format!("\u{89e3}\u{6790}\u{6df7}\u{5143}\u{54cd}\u{5e94}\u{5931}\u{8d25}: {error}"))?;
        if let Some(content) = response_body
            .choices
            .into_iter()
            .next()
            .and_then(|choice| choice.message.content)
        {
            return Ok(content);
        }
        last_error = format!("混元没有返回可用内容 [{model}]。");
    }
    Err(last_error)
}
fn build_messages(
    system_prompt: &str,
    user_prompt: String,
    _payload: &AiAnalysisPayload,
    image_data: Option<&str>,
    model: &str,
) -> Vec<ChatMessage> {
    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: MessageContent::Text(system_prompt.to_string()),
    }];
    if model_supports_vision(model) {
        let mut content = vec![ContentPart::Text { text: user_prompt }];
        if let Some(image_url) = image_data {
            content.push(ContentPart::ImageUrl {
                image_url: ImageUrl {
                    url: image_url.to_string(),
                },
            });
        }
        messages.push(ChatMessage {
            role: "user".to_string(),
            content: MessageContent::Parts(content),
        });
    } else {
        messages.push(ChatMessage {
            role: "user".to_string(),
            content: MessageContent::Text(user_prompt),
        });
    }
    messages
}
fn build_shot_review_system_prompt() -> &'static str {
    concat!(
        "You are an elite basketball shooting coach and film-room analyst. ",
        "Use the structured pose JSON as the primary evidence, and use the image only to validate rhythm, frame timing, and body alignment. ",
        "Your job is not to act like a geometry tool. Your job is to judge what this frame means in basketball terms. ",
        "Sound like a coach talking to a player, not like a lab report. ",
        "Be conservative when the frame is late release or follow-through. ",
        "If the frame timing is not reliable enough to lock a motion type, say so clearly. ",
        "Return JSON only with this schema: ",
        r#"{"source":"ai","phase":"gather|set_point|release|follow_through|unknown","phaseConfidence":0.0,"decisionMode":"confirmed|tendency|insufficient","shotType":"one_motion|one_point_five_motion|two_motion|unknown","shotTypeConfidence":0.0,"title":"string","summary":"string","reasons":["string"]}. "#,
        "Rules: ",
        "1. title must be a short Simplified Chinese UI headline. ",
        "2. summary must be 2-3 concise sentences in Simplified Chinese. ",
        "3. reasons must contain 3-5 short bullet-style strings in Simplified Chinese. ",
        "4. reasons should prioritize movement feel, rhythm, timing, and whether this frame is usable for classification. ",
        "5. Mention raw angles only when they materially support the point, and do not turn every bullet into a numeric observation. ",
        "6. Avoid repetitive templates such as listing shoulder/elbow/knee numbers in sequence. ",
        "7. For late release or follow-through frames, explain why this frame is better for reading release posture than full motion type. ",
        "8. If the current frame is late release or follow-through, prefer decisionMode=insufficient unless the evidence is unusually strong. ",
        "9. If decisionMode=insufficient, shotType should usually be unknown. ",
        "10. No markdown fences. ",
        "11. In Chinese output, do not say the English term set point directly. Use plain Chinese wording instead."
    )
}
fn build_coaching_system_prompt() -> &'static str {
    concat!(
        "You are a skilled basketball shooting coach. ",
        "Use the structured pose JSON as the main evidence. The image is only supplemental. ",
        "Sound like a real coach: natural, direct, practical. ",
        "Do not mechanically list every angle or repeat numeric ranges unless necessary. ",
        "Prioritize rhythm, pre-shot set position, balance, force transfer, and release feel. ",
        "If shotType is unknown, say the current frame is not reliable enough to force a motion-type label. ",
        "In Chinese output, avoid the term set point and use plain Chinese instead. ",
        "Return JSON only with this schema: ",
        r#"{"summary":"string","suggestions":[{"bodyPart":"string","issue":"string","suggestion":"string","priority":"high|medium|low"}]}. "#,
        "Requirements for summary: 2-4 sentences, concise Simplified Chinese, first give an overall read on the shot, then the main training focus. ",
        "Requirements for suggestions: at most 4 items, each issue should describe the movement tendency, each suggestion should be drillable and coach-like. ",
        "No markdown fences."
    )
}
fn build_shot_review_user_prompt(payload: &AiAnalysisPayload) -> String {
    let payload_json = serde_json::to_string_pretty(payload).unwrap_or_else(|_| "{}".to_string());
    format!(
        "请先判断这张投篮图片处于哪个动作阶段，再决定这张图是否适合判断 one motion / two motion。\n\
输出要求：\n\
1. 不要机械重复所有角度，重点解释这张图在篮球语义上意味着什么。\n\
2. 如果这张图更像出手瞬间或出手后段，要明确说明这张图不适合强行给完整动作分型。\n\
3. 只有在证据足够清楚时，decisionMode 才能写 confirmed。\n\
4. title 要适合直接显示在 UI 里，比如“更像一段式投篮”或“当前帧分型参考不足”。\n\
5. reasons 要短，像教练看录像结论，不要写成长段，也不要每条都报角度数字。\n\
6. 优先说动作感觉和阶段价值，比如“这张图更适合看出手姿态”“这时已经不是看分型的最佳时机”。\n\
7. If you mention the pre-release pause position in Chinese, explain it in plain language and do not write the term set point directly.\n\
结构化分析 JSON:
{payload_json}"
    )
}
fn build_coaching_user_prompt(payload: &AiAnalysisPayload) -> String {
    let payload_json = serde_json::to_string_pretty(payload).unwrap_or_else(|_| "{}".to_string());
    format!(
        "请根据这份投篮分析结果，给出一段整体动作总结和几条纠正建议。\n\
输出要求：\n\
1. 先写 summary，总结这张图里最值得关注的动作感觉，不要机械复述所有角度。\n\
2. suggestions 里优先挑 2 到 4 个最关键问题，不要面面俱到。\n\
3. issue 要像教练指出动作倾向，suggestion 要像训练口令或练习重点。\n\
4. If the phase is closer to the pre-release pause position or the release itself, explain it in that phase context instead of describing the still image like a full motion sequence.\n\
5. 可以引用少量关键角度支撑判断，但不要每条都报数字。\n\
结构化分析 JSON:
{payload_json}"
    )
}
fn parse_shot_review_response(content: &str) -> Result<AiShotReview, String> {
    let json = extract_json_block(content);
    let mut response: AiShotReview = serde_json::from_str(&json).map_err(|error| {
        format!("混元返回的主分析 JSON 格式不正确: {error}
原始内容: {content}")
    })?;
    response.source = "ai".to_string();
    response.phase = normalize_phase(&response.phase).to_string();
    response.phase_confidence = response.phase_confidence.clamp(0.0, 1.0);
    response.decision_mode = normalize_decision_mode(&response.decision_mode).to_string();
    response.shot_type_confidence = response.shot_type_confidence.clamp(0.0, 1.0);
    response.title = response.title.trim().to_string();
    response.summary = response.summary.trim().to_string();
    response.reasons = response
        .reasons
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .take(6)
        .collect();
    if response.title.is_empty() {
        response.title = default_review_title(&response);
    }
    if response.summary.is_empty() {
        response.summary = default_review_summary(&response);
    }
    if response.reasons.is_empty() {
        response.reasons = vec![
            "这张图需要结合动作阶段来解读，不建议脱离上下文硬判。".to_string(),
            "\u{66f4}\u{7a33}\u{5b9a}\u{7684}\u{5206}\u{578b}\u{901a}\u{5e38}\u{8981}\u{770b}\u{4e3e}\u{7403}\u{5230}\u{51c6}\u{5907}\u{51fa}\u{624b}\u{524d}\u{624b}\u{548c}\u{7403}\u{77ed}\u{6682}\u{505c}\u{4f4f}\u{7684}\u{4f4d}\u{7f6e}\u{9644}\u{8fd1}\u{7684}\u{753b}\u{9762}\u{3002}".to_string(),
        ];
    }
    if response.decision_mode == "insufficient" {
        response.shot_type = ShotType::Unknown;
        response.shot_type_confidence = response.shot_type_confidence.min(0.45);
    }
    Ok(response)
}
fn parse_coaching_response(content: &str) -> Result<AiCoachingResponse, String> {
    let json = extract_json_block(content);
    let mut response: AiCoachingResponse = serde_json::from_str(&json)
        .map_err(|error| format!("混元返回的 JSON 格式不正确: {error}
原始内容: {content}"))?;
    response.summary = response.summary.trim().to_string();
    if response.summary.is_empty() {
        response.summary = build_summary_from_suggestions(&response.suggestions);
    }
    for suggestion in &mut response.suggestions {
        suggestion.priority = normalize_priority(&suggestion.priority).to_string();
        if suggestion.body_part.trim().is_empty() {
            suggestion.body_part = "整体动作".to_string();
        }
        suggestion.issue = suggestion.issue.trim().to_string();
        suggestion.suggestion = suggestion.suggestion.trim().to_string();
    }
    Ok(response)
}
fn default_review_title(review: &AiShotReview) -> String {
    match review.decision_mode.as_str() {
        "confirmed" => match review.shot_type {
            ShotType::OneMotion => "一段式投篮".to_string(),
            ShotType::OnePointFiveMotion => "1.5 段式投篮".to_string(),
            ShotType::TwoMotion => "二段式投篮".to_string(),
            ShotType::Unknown => "当前帧分型参考不足".to_string(),
        },
        "tendency" => match review.shot_type {
            ShotType::OneMotion => "更像一段式投篮".to_string(),
            ShotType::OnePointFiveMotion => "更像 1.5 段式投篮".to_string(),
            ShotType::TwoMotion => "更像二段式投篮".to_string(),
            ShotType::Unknown => "当前帧分型参考不足".to_string(),
        },
        _ => "当前帧分型参考不足".to_string(),
    }
}
fn default_review_summary(review: &AiShotReview) -> String {
    match review.decision_mode.as_str() {
        "confirmed" => "当前这张图的信息足够支持分型，可以把这次结果当作主要参考。".to_string(),
        "tendency" => "这张图能看出一定动作倾向，但还不适合把分型当成最终结论。".to_string(),
        _ => "这张图更适合看当前姿态和出手阶段，不适合只凭这一帧锁定完整动作分型。".to_string(),
    }
}
fn build_summary_from_suggestions(suggestions: &[CorrectionSuggestion]) -> String {
    if suggestions.is_empty() {
        return "这张图里没有看到特别突出的单点问题，先保持当前出手节奏，再结合连续动作观察稳定性。"
            .to_string();
    }
    let focus = suggestions
        .iter()
        .take(2)
        .map(|item| item.body_part.as_str())
        .collect::<Vec<_>>()
        .join("、");
    format!(
        "这张图里最需要先收的是 {focus} 的配合。先把动作顺下来，再去追求更多细节，会比逐条抠角度更有效。"
    )
}
fn extract_json_block(content: &str) -> String {
    let trimmed = content.trim();
    let without_fence = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed)
        .trim()
        .strip_suffix("```")
        .unwrap_or(trimmed)
        .trim();
    if let (Some(start), Some(end)) = (without_fence.find('{'), without_fence.rfind('}')) {
        return without_fence[start..=end].to_string();
    }
    without_fence.to_string()
}
fn normalize_priority(priority: &str) -> &str {
    match priority {
        "high" | "medium" | "low" => priority,
        "urgent" => "high",
        "normal" => "medium",
        _ => "medium",
    }
}
fn normalize_phase(phase: &str) -> &str {
    match phase {
        "gather" | "set_point" | "release" | "follow_through" | "unknown" => phase,
        "late_release" => "release",
        _ => "unknown",
    }
}
fn normalize_decision_mode(mode: &str) -> &str {
    match mode {
        "confirmed" | "tendency" | "insufficient" => mode,
        "tentative" => "tendency",
        _ => "insufficient",
    }
}
fn resolve_candidate_models(has_image: bool) -> Vec<String> {
    let default_model =
        std::env::var("HUNYUAN_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string());
    let vision_model =
        std::env::var("HUNYUAN_VISION_MODEL").unwrap_or_else(|_| DEFAULT_VISION_MODEL.to_string());
    let mut models = Vec::new();
    if has_image {
        if model_supports_vision(&default_model) {
            models.push(default_model.clone());
        } else {
            models.push(vision_model);
            models.push(default_model.clone());
        }
    } else {
        models.push(default_model.clone());
    }
    models.dedup();
    models
}
fn model_supports_vision(model: &str) -> bool {
    let lowered = model.to_ascii_lowercase();
    lowered.contains("vision") || lowered.contains("vl")
}
fn read_env<const N: usize>(keys: [&str; N]) -> Result<String, String> {
    for key in keys {
        if let Ok(value) = std::env::var(key) {
            if !value.trim().is_empty() {
                return Ok(value);
            }
        }
    }
    Err("未配置混元 API Key。请在启动应用前设置 HUNYUAN_API_KEY 环境变量。".to_string())
}

#[derive(Debug, PartialEq, Eq)]
enum ApiErrorKind {
    RateLimited,
    Unauthorized,
    Other,
}

fn classify_api_error(status: reqwest::StatusCode, body: &str) -> ApiErrorKind {
    let lowered = body.to_ascii_lowercase();

    if status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || body.contains("\"code\":\"2003\"")
        || body.contains("\"code\":2003")
        || body.contains("请求限频")
        || lowered.contains("rate limit")
        || lowered.contains("too many requests")
    {
        return ApiErrorKind::RateLimited;
    }

    if status == reqwest::StatusCode::UNAUTHORIZED
        || status == reqwest::StatusCode::FORBIDDEN
        || lowered.contains("invalid api key")
        || lowered.contains("authentication")
        || body.contains("鉴权")
    {
        return ApiErrorKind::Unauthorized;
    }

    ApiErrorKind::Other
}

fn should_try_next_model(kind: &ApiErrorKind) -> bool {
    !matches!(kind, ApiErrorKind::RateLimited | ApiErrorKind::Unauthorized)
}

fn format_api_error_message(model: &str, status: reqwest::StatusCode, body: &str) -> String {
    match classify_api_error(status, body) {
        ApiErrorKind::RateLimited => {
            format!("混元服务当前请求过于频繁 [{model}]，请稍后重试。")
        }
        ApiErrorKind::Unauthorized => {
            "混元 API 认证失败，请检查 HUNYUAN_API_KEY 是否正确。".to_string()
        }
        ApiErrorKind::Other => {
            format!("混元 API 暂时不可用 ({status}) [{model}]，请稍后重试。")
        }
    }
}
#[derive(Serialize)]
struct ChatCompletionsRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
}
#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: MessageContent,
}
#[derive(Serialize)]
#[serde(untagged)]
enum MessageContent {
    Text(String),
    Parts(Vec<ContentPart>),
}
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ContentPart {
    Text { text: String },
    ImageUrl { image_url: ImageUrl },
}
#[derive(Serialize)]
struct ImageUrl {
    url: String,
}
#[derive(Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<Choice>,
}
#[derive(Deserialize)]
struct Choice {
    message: AssistantMessage,
}
#[derive(Deserialize)]
struct AssistantMessage {
    content: Option<String>,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn strips_markdown_fence_from_json() {
        let content = "```json
{\"summary\":\"ok\",\"suggestions\":[]}
```";
        assert_eq!(
            extract_json_block(content),
            "{\"summary\":\"ok\",\"suggestions\":[]}"
        );
    }
    #[test]
    fn detects_vision_models() {
        assert!(model_supports_vision("hunyuan-turbos-vision-20250619"));
        assert!(model_supports_vision("hunyuan-vl-plus"));
        assert!(!model_supports_vision("hunyuan-turbos-latest"));
    }
    #[test]
    fn prefers_vision_model_when_image_is_present() {
        std::env::set_var("HUNYUAN_MODEL", "hunyuan-turbos-latest");
        std::env::remove_var("HUNYUAN_VISION_MODEL");
        let models = resolve_candidate_models(true);
        assert_eq!(
            models.first().map(String::as_str),
            Some(DEFAULT_VISION_MODEL)
        );
        assert_eq!(
            models.get(1).map(String::as_str),
            Some("hunyuan-turbos-latest")
        );
    }
    #[test]
    fn builds_summary_when_model_omits_it() {
        let response = parse_coaching_response(
            "{\"summary\":\"\",\"suggestions\":[{\"bodyPart\":\"肩膀\",\"issue\":\"抬肩偏多\",\"suggestion\":\"先把肩放松\",\"priority\":\"high\"}]}",
        )
        .expect("response should parse");
        assert!(!response.summary.is_empty());
    }
    #[test]
    fn normalizes_insufficient_review_to_unknown() {
        let review = parse_shot_review_response(
            "{\"source\":\"ai\",\"phase\":\"follow_through\",\"phaseConfidence\":0.9,\"decisionMode\":\"insufficient\",\"shotType\":\"two_motion\",\"shotTypeConfidence\":0.7,\"title\":\"\",\"summary\":\"\",\"reasons\":[]}",
        )
        .expect("review should parse");
        assert_eq!(review.shot_type, ShotType::Unknown);
        assert!(review.shot_type_confidence <= 0.45);
        assert_eq!(review.decision_mode, "insufficient");
    }

    #[test]
    fn rewrites_rate_limit_provider_errors_to_friendly_message() {
        let message = format_api_error_message(
            "hunyuan-turbos-latest",
            reqwest::StatusCode::BAD_REQUEST,
            r#"{"error":{"message":"请求限频，请稍后重试","code":"2003"}}"#,
        );

        assert!(message.contains("请求过于频繁"));
        assert!(!message.contains("\"error\""));
    }

    #[test]
    fn rate_limit_errors_stop_model_fallback_retries() {
        let kind = classify_api_error(
            reqwest::StatusCode::BAD_REQUEST,
            r#"{"error":{"message":"请求限频，请稍后重试","code":"2003"}}"#,
        );

        assert_eq!(kind, ApiErrorKind::RateLimited);
        assert!(!should_try_next_model(&kind));
    }
}
