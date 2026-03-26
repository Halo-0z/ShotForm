export const HOME_HERO_COPY = {
  headline: '\u770b\u89c1\u4f60\u7684\u51fa\u624b\u8282\u594f',
  subtitle:
    '\u57fa\u4e8e\u59ff\u6001\u8bc6\u522b\u4e0e\u5173\u952e\u5e27\u5206\u6790\uff0c\u5e2e\u52a9\u4f60\u66f4\u6e05\u695a\u5730\u7406\u89e3\u6295\u7bee\u52a8\u4f5c\u3001\u51fa\u624b\u8282\u594f\u4e0e\u53d1\u529b\u7ed3\u6784\u3002',
  cta: '\u5f00\u59cb\u5206\u6790'
}

export function getInitialHeroMode(hasAnalysis) {
  return hasAnalysis ? 'workspace' : 'cover'
}

export function shouldReduceHeroMotion(prefersReducedMotion) {
  return Boolean(prefersReducedMotion)
}
