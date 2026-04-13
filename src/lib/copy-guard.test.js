import test from 'node:test'
import assert from 'node:assert/strict'

const importCopyGuard = async () => {
  try {
    return await import('./copy-guard.js')
  } catch (error) {
    assert.fail(`copy guard module missing: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const makeElement = (tagName, { parent = null, allowCopy = false, editable = false } = {}) => {
  const attributes = new Map()

  if (allowCopy) {
    attributes.set('data-allow-copy', 'true')
  }

  if (editable) {
    attributes.set('contenteditable', 'true')
  }

  return {
    nodeType: 1,
    tagName,
    parentNode: parent,
    isContentEditable: editable,
    getAttribute(name) {
      return attributes.get(name) ?? null
    }
  }
}

const makeTextNode = (parent) => ({
  nodeType: 3,
  parentNode: parent
})

test('copy guard only allows selections inside explicitly whitelisted analysis content', async () => {
  const { isCopyAllowedForSelection } = await importCopyGuard()
  const root = makeElement('DIV')
  const allowed = makeElement('DIV', { parent: root, allowCopy: true })
  const textNode = makeTextNode(allowed)

  assert.equal(
    isCopyAllowedForSelection({
      rangeCount: 1,
      anchorNode: textNode,
      focusNode: textNode
    }),
    true
  )

  const blockedText = makeTextNode(root)
  assert.equal(
    isCopyAllowedForSelection({
      rangeCount: 1,
      anchorNode: blockedText,
      focusNode: blockedText
    }),
    false
  )
})

test('copy guard preserves copy access for editable controls', async () => {
  const { isCopyAllowedForSelection } = await importCopyGuard()
  const root = makeElement('DIV')
  const textarea = makeElement('TEXTAREA', { parent: root })
  const textareaText = makeTextNode(textarea)
  const editable = makeElement('DIV', { parent: root, editable: true })
  const editableText = makeTextNode(editable)

  assert.equal(
    isCopyAllowedForSelection({
      rangeCount: 1,
      anchorNode: textareaText,
      focusNode: textareaText
    }),
    true
  )

  assert.equal(
    isCopyAllowedForSelection({
      rangeCount: 1,
      anchorNode: editableText,
      focusNode: editableText
    }),
    true
  )
})

test('copy guard handlers block copy and cut outside the whitelist', async () => {
  const { createCopyGuardHandlers } = await importCopyGuard()
  const root = makeElement('DIV')
  const blockedText = makeTextNode(root)
  const handlers = createCopyGuardHandlers({
    getSelection: () => ({
      rangeCount: 1,
      anchorNode: blockedText,
      focusNode: blockedText
    })
  })

  let prevented = false
  handlers.handleCopy({
    preventDefault() {
      prevented = true
    }
  })
  assert.equal(prevented, true)

  prevented = false
  handlers.handleCut({
    preventDefault() {
      prevented = true
    }
  })
  assert.equal(prevented, true)
})

test('copy guard handlers allow copy inside analysis whitelist', async () => {
  const { createCopyGuardHandlers } = await importCopyGuard()
  const root = makeElement('DIV')
  const allowed = makeElement('DIV', { parent: root, allowCopy: true })
  const allowedText = makeTextNode(allowed)
  const handlers = createCopyGuardHandlers({
    getSelection: () => ({
      rangeCount: 1,
      anchorNode: allowedText,
      focusNode: allowedText
    })
  })

  let prevented = false
  handlers.handleCopy({
    preventDefault() {
      prevented = true
    }
  })

  assert.equal(prevented, false)
})
