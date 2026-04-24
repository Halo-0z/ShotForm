use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct SuggestionConfig {
    pub rules: Vec<SuggestionRule>,
}

#[derive(Debug, Deserialize)]
pub struct SuggestionRule {
    pub angle_names: Vec<String>,
    pub body_part: String,
    pub too_small: Option<DirectionConfig>,
    pub too_large: Option<DirectionConfig>,
}

#[derive(Debug, Deserialize)]
pub struct DirectionConfig {
    pub issue_template: String,
    pub suggestion: String,
    pub priority_threshold: Option<f32>,
    pub priority: Option<String>,
}

impl DirectionConfig {
    pub fn resolve_priority(&self, deviation: f32) -> String {
        if let Some(threshold) = self.priority_threshold {
            if deviation > threshold {
                "high".to_string()
            } else {
                "medium".to_string()
            }
        } else {
            self.priority
                .clone()
                .unwrap_or_else(|| "medium".to_string())
        }
    }

    pub fn format_issue(&self, value: f32) -> String {
        self.issue_template
            .replace("{value}", &format!("{:.1}", value))
    }
}

impl SuggestionConfig {
    pub fn load() -> Self {
        let json_str = include_str!("suggestions.json");
        serde_json::from_str(json_str).expect("Failed to parse suggestions.json")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn direction_config_resolves_threshold_priority() {
        let config = DirectionConfig {
            issue_template: "test {value}".to_string(),
            suggestion: "suggestion".to_string(),
            priority_threshold: Some(20.0),
            priority: None,
        };
        assert_eq!(config.resolve_priority(25.0), "high");
        assert_eq!(config.resolve_priority(15.0), "medium");
        assert_eq!(config.resolve_priority(20.0), "medium");
    }

    #[test]
    fn direction_config_resolves_fixed_priority() {
        let config = DirectionConfig {
            issue_template: "test {value}".to_string(),
            suggestion: "suggestion".to_string(),
            priority_threshold: None,
            priority: Some("high".to_string()),
        };
        assert_eq!(config.resolve_priority(0.0), "high");
    }

    #[test]
    fn direction_config_defaults_to_medium() {
        let config = DirectionConfig {
            issue_template: "test {value}".to_string(),
            suggestion: "suggestion".to_string(),
            priority_threshold: None,
            priority: None,
        };
        assert_eq!(config.resolve_priority(0.0), "medium");
    }

    #[test]
    fn direction_config_formats_issue() {
        let config = DirectionConfig {
            issue_template: "肘角偏小（{value}°），出手点可能偏低。".to_string(),
            suggestion: "suggestion".to_string(),
            priority_threshold: None,
            priority: None,
        };
        assert_eq!(
            config.format_issue(85.3),
            "肘角偏小（85.3°），出手点可能偏低。"
        );
    }

    #[test]
    fn suggestion_config_loads_successfully() {
        let config = SuggestionConfig::load();
        assert_eq!(config.rules.len(), 6);

        let elbow_rule = config
            .rules
            .iter()
            .find(|r| r.angle_names.contains(&"left_elbow_angle".to_string()))
            .unwrap();
        assert_eq!(elbow_rule.body_part, "手肘");
        assert!(elbow_rule.too_small.is_some());
        assert!(elbow_rule.too_large.is_some());
    }
}
