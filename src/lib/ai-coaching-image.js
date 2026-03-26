const DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,/i
const REMOTE_URL_PATTERN = /^https?:\/\//i

const imageMimeTypeFromPath = (path) => {
  const lower = path.toLowerCase()

  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.bmp')) return 'image/bmp'
  return 'image/png'
}

const uint8ArrayToBase64 = (bytes) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const readLocalImageFile = async (path) => {
  const { readFile } = await import('@tauri-apps/plugin-fs')
  return readFile(path)
}

export const resolveAiImageSource = async (source, reader = readLocalImageFile) => {
  if (!source) {
    return null
  }

  const trimmed = source.trim()
  if (!trimmed) {
    return null
  }

  if (DATA_URL_PATTERN.test(trimmed) || REMOTE_URL_PATTERN.test(trimmed)) {
    return trimmed
  }

  const bytes = await reader(trimmed)
  return `data:${imageMimeTypeFromPath(trimmed)};base64,${uint8ArrayToBase64(bytes)}`
}
