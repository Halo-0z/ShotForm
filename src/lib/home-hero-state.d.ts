export type HeroMode = 'cover' | 'workspace'

export declare const HOME_HERO_COPY: {
  headline: string
  subtitle: string
  cta: string
}

export declare function getInitialHeroMode(hasAnalysis: boolean): HeroMode

export declare function shouldReduceHeroMotion(prefersReducedMotion: boolean): boolean
