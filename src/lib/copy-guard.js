export const COPY_LOCK_CLASS = 'app-copy-locked'
export const ALLOW_COPY_ATTRIBUTE = 'data-allow-copy'

const ELEMENT_NODE = 1

const getParentNode = (node) => node?.parentNode ?? null

const getClosestElement = (node) => {
  let current = node ?? null

  while (current) {
    if (current.nodeType === ELEMENT_NODE) {
      return current
    }

    current = getParentNode(current)
  }

  return null
}

const isEditableElement = (element) => {
  if (!element) return false

  const tagName = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
    return true
  }

  if (element.isContentEditable) {
    return true
  }

  const contentEditable = element.getAttribute?.('contenteditable')
  return contentEditable === '' || contentEditable === 'true' || contentEditable === 'plaintext-only'
}

const isAllowedElement = (element) => {
  let current = element

  while (current) {
    if (isEditableElement(current)) {
      return true
    }

    if (current.getAttribute?.(ALLOW_COPY_ATTRIBUTE) === 'true') {
      return true
    }

    current = getClosestElement(getParentNode(current))
  }

  return false
}

const getSelectionNodes = (selection) => {
  const nodes = []

  if (selection?.anchorNode) {
    nodes.push(selection.anchorNode)
  }

  if (selection?.focusNode && selection.focusNode !== selection.anchorNode) {
    nodes.push(selection.focusNode)
  }

  if (typeof selection?.getRangeAt === 'function' && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    if (range?.commonAncestorContainer) {
      nodes.push(range.commonAncestorContainer)
    }
  }

  return nodes
}

export const isCopyAllowedForSelection = (selection) => {
  if (!selection || selection.rangeCount === 0) {
    return false
  }

  const nodes = getSelectionNodes(selection)
  if (!nodes.length) {
    return false
  }

  return nodes.every((node) => isAllowedElement(getClosestElement(node)))
}

const blockIfNeeded = (event, getSelection) => {
  if (isCopyAllowedForSelection(getSelection())) {
    return
  }

  event.preventDefault?.()
}

export const createCopyGuardHandlers = (
  { getSelection = () => globalThis.window?.getSelection?.() ?? null } = {}
) => ({
  handleCopy(event) {
    blockIfNeeded(event, getSelection)
  },
  handleCut(event) {
    blockIfNeeded(event, getSelection)
  }
})
