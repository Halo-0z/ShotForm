## Shot Type Regression Fixtures

`shot_type_regression_samples.json` stores user-facing regression samples for shot type classification.

Guidelines:
- Prefer real player images from `../star/` that represent common user uploads.
- Keep one fixture focused on one expectation: `one_motion`, `two_motion`, or `unknown`.
- Use `unknown` for late release / follow-through frames where the product should avoid overclaiming.
- Use real detected keypoints whenever possible instead of hand-crafted coordinates.

Current exclusions:
- `../star/东契奇投篮姿势分析.png`
  This is a chart screenshot, not a raw pose image, so it should not be used as a pose-classification fixture.
