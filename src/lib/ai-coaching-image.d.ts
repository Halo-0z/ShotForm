export declare function resolveAiImageSource(
  source: string | null | undefined,
  reader?: (path: string) => Promise<Uint8Array>
): Promise<string | null>
