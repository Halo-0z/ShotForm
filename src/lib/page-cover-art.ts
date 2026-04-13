export const PAGE_COVER_ART = {
  home: '/hero/jordan-logo-home.png',
  upload: '/hero/jordan-dunk.png',
  analysis: '/hero/jordan-shot-analysis.png',
  history: '/hero/the-shot-history.png',
  compare: '/hero/jordan-dunk.png'
} as const

export type PageCoverArtKey = keyof typeof PAGE_COVER_ART
