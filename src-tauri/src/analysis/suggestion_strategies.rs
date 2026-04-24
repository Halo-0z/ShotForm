use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use crate::models::{CorrectionSuggestion, JointAngle};

use super::suggestion_config::{DirectionConfig, SuggestionConfig, SuggestionRule};

pub trait AngleSuggestionStrategy: Send + Sync {
    fn generate_suggestion(&self, angle: &JointAngle) -> Option<CorrectionSuggestion>;
}

struct RuleBasedStrategy {
    rule: SuggestionRule,
}

impl RuleBasedStrategy {
    fn build_suggestion(
        &self,
        dir_config: &DirectionConfig,
        angle: &JointAngle,
        deviation: f32,
    ) -> CorrectionSuggestion {
        CorrectionSuggestion {
            body_part: self.rule.body_part.clone(),
            issue: dir_config.format_issue(angle.value),
            suggestion: dir_config.suggestion.clone(),
            priority: dir_config.resolve_priority(deviation),
        }
    }
}

impl AngleSuggestionStrategy for RuleBasedStrategy {
    fn generate_suggestion(&self, angle: &JointAngle) -> Option<CorrectionSuggestion> {
        if angle.value < angle.normal_range.0 {
            let dir_config = self.rule.too_small.as_ref()?;
            let deviation = angle.normal_range.0 - angle.value;
            Some(self.build_suggestion(dir_config, angle, deviation))
        } else if angle.value > angle.normal_range.1 {
            let dir_config = self.rule.too_large.as_ref()?;
            let deviation = angle.value - angle.normal_range.1;
            Some(self.build_suggestion(dir_config, angle, deviation))
        } else {
            None
        }
    }
}

pub struct SuggestionStrategyFactory {
    strategies: HashMap<String, Arc<dyn AngleSuggestionStrategy>>,
}

impl SuggestionStrategyFactory {
    pub fn new() -> Self {
        let config = SuggestionConfig::load();
        let mut strategies = HashMap::new();

        for rule in config.rules {
            let angle_names = rule.angle_names.clone();
            let strategy: Arc<dyn AngleSuggestionStrategy> =
                Arc::new(RuleBasedStrategy { rule });

            for name in angle_names {
                strategies.insert(name, strategy.clone());
            }
        }

        Self { strategies }
    }

    pub fn get_strategy(&self, angle_name: &str) -> Option<Arc<dyn AngleSuggestionStrategy>> {
        self.strategies.get(angle_name).cloned()
    }
}

impl Default for SuggestionStrategyFactory {
    fn default() -> Self {
        Self::new()
    }
}

static STRATEGY_FACTORY: OnceLock<SuggestionStrategyFactory> = OnceLock::new();

pub fn get_factory() -> &'static SuggestionStrategyFactory {
    STRATEGY_FACTORY.get_or_init(SuggestionStrategyFactory::new)
}

pub fn generate_suggestion(angle: &JointAngle) -> Option<CorrectionSuggestion> {
    if angle.status == "low_confidence" {
        return None;
    }

    get_factory()
        .get_strategy(&angle.name)
        .and_then(|strategy| strategy.generate_suggestion(angle))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_angle(name: &str, value: f32, normal_range: (f32, f32)) -> JointAngle {
        JointAngle {
            name: name.to_string(),
            value,
            normal_range,
            status: "warning".to_string(),
            confidence: 0.9,
        }
    }

    #[test]
    fn elbow_too_small_returns_suggestion() {
        let angle = make_angle("left_elbow_angle", 70.0, (90.0, 120.0));
        let result = generate_suggestion(&angle).unwrap();
        assert_eq!(result.body_part, "手肘");
        assert!(result.issue.contains("肘角偏小"));
        assert_eq!(result.priority, "high");
    }

    #[test]
    fn elbow_slightly_small_returns_medium() {
        let angle = make_angle("right_elbow_angle", 85.0, (90.0, 120.0));
        let result = generate_suggestion(&angle).unwrap();
        assert_eq!(result.priority, "medium");
    }

    #[test]
    fn elbow_too_large_returns_suggestion() {
        let angle = make_angle("shooting_elbow_angle", 150.0, (90.0, 120.0));
        let result = generate_suggestion(&angle).unwrap();
        assert!(result.issue.contains("肘角偏大"));
    }

    #[test]
    fn elbow_in_range_returns_none() {
        let angle = make_angle("left_elbow_angle", 100.0, (90.0, 120.0));
        assert!(generate_suggestion(&angle).is_none());
    }

    #[test]
    fn knee_too_small_returns_medium() {
        let angle = make_angle("left_knee_angle", 120.0, (140.0, 170.0));
        let result = generate_suggestion(&angle).unwrap();
        assert_eq!(result.body_part, "下肢");
        assert_eq!(result.priority, "medium");
    }

    #[test]
    fn shoulder_too_small_returns_high() {
        let angle = make_angle("left_shoulder_angle", 80.0, (100.0, 140.0));
        let result = generate_suggestion(&angle).unwrap();
        assert_eq!(result.body_part, "肩部");
        assert_eq!(result.priority, "high");
    }

    #[test]
    fn hip_too_small_returns_high() {
        let angle = make_angle("left_hip_angle", 100.0, (140.0, 180.0));
        let result = generate_suggestion(&angle).unwrap();
        assert_eq!(result.body_part, "躯干");
        assert_eq!(result.priority, "high");
    }

    #[test]
    fn hip_has_no_too_large() {
        let angle = make_angle("right_hip_angle", 200.0, (140.0, 180.0));
        assert!(generate_suggestion(&angle).is_none());
    }

    #[test]
    fn trunk_tilt_too_large_returns_medium() {
        let angle = make_angle("trunk_tilt", 25.0, (0.0, 15.0));
        let result = generate_suggestion(&angle).unwrap();
        assert_eq!(result.body_part, "躯干");
        assert_eq!(result.priority, "medium");
    }

    #[test]
    fn shoulder_tilt_too_large_returns_medium() {
        let angle = make_angle("shoulder_tilt", 12.0, (0.0, 5.0));
        let result = generate_suggestion(&angle).unwrap();
        assert_eq!(result.body_part, "肩部");
        assert_eq!(result.priority, "medium");
    }

    #[test]
    fn low_confidence_returns_none() {
        let mut angle = make_angle("left_elbow_angle", 70.0, (90.0, 120.0));
        angle.status = "low_confidence".to_string();
        assert!(generate_suggestion(&angle).is_none());
    }

    #[test]
    fn unknown_angle_returns_none() {
        let angle = make_angle("unknown_angle", 50.0, (90.0, 120.0));
        assert!(generate_suggestion(&angle).is_none());
    }
}
