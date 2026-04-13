export declare const COPY_LOCK_CLASS: 'app-copy-locked'
export declare const ALLOW_COPY_ATTRIBUTE: 'data-allow-copy'

export declare function isCopyAllowedForSelection(selection: Selection | null | undefined): boolean

export declare function createCopyGuardHandlers(options?: {
  getSelection?: () => Selection | null | undefined
}): {
  handleCopy: (event: Event) => void
  handleCut: (event: Event) => void
}
