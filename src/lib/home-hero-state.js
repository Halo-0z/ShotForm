export const HOME_HERO_COPY = {
  headline: '看见你的出手节奏',
  subtitle:
    '基于姿态识别与关键帧分析，帮助你更清楚地理解投篮动作、出手节奏与发力结构。',
  cta: '开始分析'
}

export function shouldReduceHeroMotion(prefersReducedMotion) {
  return Boolean(prefersReducedMotion)
}
