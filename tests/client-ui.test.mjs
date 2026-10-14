import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'

import { apply } from '../src/client.js'

const state = (overrides = {}) => ({
  sessionId: 'session-one',
  currentWorkspaceId: 'old',
  currentPath: '/projects/old',
  active: false,
  supported: true,
  workspaces: [
    { workspaceId: 'old', title: 'Old', path: '/projects/old' },
    { workspaceId: 'new', title: 'New', path: '/projects/new' },
  ],
  ...overrides,
})

const messages = {
  'menu.move': 'Move to another workspace',
  'dialog.title': 'Move session',
  'dialog.help': 'The session ID stays the same.',
  'dialog.current': 'Current workspace',
  'dialog.target': 'Target workspace',
  'dialog.cancel': 'Cancel',
  'dialog.move': 'Move',
  'dialog.moving': 'Moving safely…',
  'dialog.moved': 'Moved to “{title}”.',
  'dialog.ungrouped': 'Ungrouped',
  'drag.moved': 'Moved to “{title}”.',
  'reason.session-active': 'This session is still active. Switch to another session, wait for it to close, then try again.',
  'reason.unsupported': 'This DSH version or persistence backend cannot move sessions safely.',
  'reason.no-targets': 'No other workspace is available.',
  'error.load': 'Could not load workspaces: {message}',
  'error.move': 'Move failed: {message}',
  'error.already-moving': 'A move for this session is already in progress.',
}

function translator(key, values = {}) {
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement), messages[key] ?? key)
}

function setup({ sessionState = state(), moveResult = { ok: true }, slotSnapshot = [{ name: 'sidebar.workspaces.session.menu.item' }], omitSnapshot = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost' })
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    Event: globalThis.Event,
  }
  globalThis.document = dom.window.document
  globalThis.window = dom.window
  globalThis.Event = dom.window.Event
  const calls = []
  let registration
  let registrationRemoved = false
  let localeRemoved = false
  const disposers = []
  const ctx = {
    connection: {
      rpc: {
        async call(path, method, payload) {
          calls.push({ path, method, payload })
          if (method === 'state') return { ok: true, value: sessionState }
          return moveResult
        },
      },
    },
    locale: {
      bind: () => translator,
      register: () => () => { localeRemoved = true },
    },
    slots: {
      ...(!omitSnapshot ? { snapshot: key => {
        assert.equal(key, 'sidebar.workspaces.session.menu.item')
        return slotSnapshot
      } } : {}),
      inject(name, callback) {
        assert.equal(name, 'sidebar.workspaces.session.menu.item')
        return callback()
      },
      register(config, component) {
        registration = { config, component }
        return () => { registrationRemoved = true }
      },
    },
    effect(effect) {
      const dispose = effect()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
  }
  apply(ctx)
  return {
    dom,
    ctx,
    calls,
    disposers,
    registration: () => registration,
    teardown() {
      for (const dispose of disposers.reverse()) dispose()
      dom.window.close()
      if (previous.document === undefined) delete globalThis.document
      else globalThis.document = previous.document
      if (previous.window === undefined) delete globalThis.window
      else globalThis.window = previous.window
      if (previous.Event === undefined) delete globalThis.Event
      else globalThis.Event = previous.Event
      return { registrationRemoved, localeRemoved }
    },
  }
}

function dispatchDrag(dom, target, type, dataTransfer = { dropEffect: 'none' }) {
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  target.dispatchEvent(event)
  return event
}

function createWorkspaceTree() {
  const tree = document.createElement('div')
  tree.setAttribute('role', 'tree')
  document.body.append(tree)
  return tree
}

function makeWorkspaceGroup(workspaceId, sessionIds = []) {
  const container = document.createElement('div')
  const headerWrapper = document.createElement('span')
  const header = document.createElement('div')
  header.dataset.rowKey = `workspace:${workspaceId}`
  header.setAttribute('role', 'treeitem')
  const headerChild = document.createElement('span')
  header.append(headerChild)
  headerWrapper.append(header)
  container.append(headerWrapper)

  const sessions = sessionIds.map((sessionId) => {
    const rowWrapper = document.createElement('span')
    const row = document.createElement('div')
    row.dataset.rowKey = `session:${sessionId}`
    row.setAttribute('role', 'treeitem')
    const child = document.createElement('span')
    row.append(child)
    rowWrapper.append(row)
    container.append(rowWrapper)
    return { row, child, rowWrapper }
  })

  const padding = document.createElement('div')
  container.append(padding)
  return { container, header, headerChild, sessions, padding }
}

function addWorkspaceGroup(tree, workspaceId, sessionIds = []) {
  const group = makeWorkspaceGroup(workspaceId, sessionIds)
  tree.append(group.container)
  return group
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve))
}

test('the official session menu slot opens the workspace chooser and moves the same session ID', async (t) => {
  const app = setup()
  t.after(() => app.teardown())
  const registered = app.registration()
  assert.equal(registered.config.name, 'sidebar.workspaces.session.menu.item')
  assert.equal(registered.config.id, 'dsh-session-workspace.move')
  assert.equal(registered.config.order, 500)

  const moveSession = registered.config.inject().moveSession
  const menuState = []
  const button = registered.component({
    sessionId: 'session-one',
    displayTitle: 'A conversation',
    useMenuOpenState: () => [true, value => menuState.push(value)],
    moveSession,
    t: translator,
  })
  const anchor = document.createElement('button')
  document.body.append(anchor)
  button.props.onClick({
    preventDefault() {},
    stopPropagation() {},
    currentTarget: anchor,
  })
  await flush()

  assert.deepEqual(menuState, [false])
  assert.deepEqual(app.calls[0], {
    path: '/dsh-session-workspace',
    method: 'state',
    payload: { sessionId: 'session-one' },
  })
  const dialog = document.querySelector('[role="dialog"]')
  assert.ok(dialog)
  const select = dialog.querySelector('select')
  assert.deepEqual(Array.from(select.options, option => option.value), ['new'])
  assert.equal(select.value, 'new')

  dialog.querySelector('button.dsw-primary').click()
  await flush()
  assert.deepEqual(app.calls.at(-1), {
    path: '/dsh-session-workspace',
    method: 'move',
    payload: { sessionId: 'session-one', workspaceId: 'new' },
  })
  await new Promise(resolve => setTimeout(resolve, 750))
})

test('the bounded legacy menu fallback opens the chooser for the exact fiber session ID', async (t) => {
  const sessionId = 'legacy-session-exact-id'
  const app = setup({ sessionState: state({ sessionId }), slotSnapshot: [] })
  t.after(async () => {
    await new Promise(resolve => setTimeout(resolve, 110))
    app.teardown()
  })
  assert.equal(app.registration(), undefined, 'an undeclared legacy menu slot must not register a modern entry')

  const row = document.createElement('div')
  row.setAttribute('role', 'treeitem')
  const anchor = document.createElement('button')
  row.append(anchor)
  document.body.append(row)
  anchor.__reactFiber$legacy = {
    memoizedProps: {},
    return: { memoizedProps: { node: { id: sessionId } }, return: null },
  }
  let menu
  anchor.getBoundingClientRect = () => ({ left: 10, top: 10, bottom: 20, width: 24, height: 24 })
  anchor.addEventListener('click', () => {
    if (menu?.isConnected) {
      menu.remove()
      return
    }
    menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    menu.getBoundingClientRect = () => ({ left: 10, top: 20, bottom: 120, width: 160, height: 100 })
    const template = document.createElement('button')
    template.setAttribute('role', 'menuitem')
    template.append(document.createElement('span'), document.createElement('span'))
    menu.append(template)
    document.body.append(menu)
  })

  anchor.click()
  await new Promise(resolve => setTimeout(resolve, 10))
  const moveItem = menu.querySelector('[data-dsh-session-workspace]')
  assert.ok(moveItem)
  assert.equal(moveItem.dataset.dshSessionWorkspace, sessionId)
  moveItem.click()
  await flush()
  assert.deepEqual(app.calls[0], {
    path: '/dsh-session-workspace',
    method: 'state',
    payload: { sessionId },
  })
  assert.ok(document.querySelector('[role="dialog"]'), 'the legacy item opens the workspace chooser')
})

test('a modern test context without snapshot defaults to the slot path, never the legacy fallback', async (t) => {
  const app = setup({ omitSnapshot: true })
  t.after(() => app.teardown())
  const row = document.createElement('div')
  row.setAttribute('role', 'treeitem')
  const anchor = document.createElement('button')
  row.append(anchor)
  document.body.append(row)
  anchor.__reactFiber$legacy = {
    memoizedProps: {},
    return: { memoizedProps: { node: { id: 'session-one' } }, return: null },
  }
  let menu
  anchor.getBoundingClientRect = () => ({ left: 10, top: 10, bottom: 20, width: 24, height: 24 })
  anchor.addEventListener('click', () => {
    menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    menu.getBoundingClientRect = () => ({ left: 10, top: 20, bottom: 120, width: 160, height: 100 })
    const template = document.createElement('button')
    template.setAttribute('role', 'menuitem')
    template.append(document.createElement('span'), document.createElement('span'))
    menu.append(template)
    document.body.append(menu)
  })

  anchor.click()
  await new Promise(resolve => setTimeout(resolve, 110))
  assert.equal(menu.querySelector('[data-dsh-session-workspace]'), null)
  assert.equal(app.calls.some(call => call.method === 'state'), false)
})

test('dragging a session row onto a different workspace moves once and reports the result', async (t) => {
  const app = setup()
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new')
  let hostWorkspaceDragOver = false
  targetGroup.header.addEventListener('dragover', () => { hostWorkspaceDragOver = true })

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  const dataTransfer = { dropEffect: 'none' }
  const over = dispatchDrag(app.dom, targetGroup.headerChild, 'dragover', dataTransfer)
  assert.equal(over.defaultPrevented, true)
  assert.equal(dataTransfer.dropEffect, 'move')
  assert.equal(hostWorkspaceDragOver, false, 'the workspace reorder handler must not receive a session drop')
  assert.equal(targetGroup.container.getAttribute('data-dsw-drop-target'), 'true', 'the entire target group is highlighted')
  assert.equal(targetGroup.header.parentElement.hasAttribute('data-dsw-drop-target'), false, 'the transparent header wrapper is not highlighted as the whole target')
  assert.equal(tree.hasAttribute('data-dsw-drop-target'), false, 'highlighting does not escape the selected group to the tree root')

  const drop = dispatchDrag(app.dom, targetGroup.headerChild, 'drop', dataTransfer)
  assert.equal(drop.defaultPrevented, true)
  dispatchDrag(app.dom, targetGroup.headerChild, 'drop', dataTransfer)
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new' },
  ])
  assert.match(document.querySelector('[role="status"]').textContent, /Moved to “New”/)
})

test('cross-workspace drops from target session content or group padding resolve to that group', async (t) => {
  const app = setup({ sessionState: state({
    workspaces: [
      { workspaceId: 'old', title: 'Old', path: '/projects/old' },
      { workspaceId: 'new', title: 'New', path: '/projects/new' },
      { workspaceId: 'empty', title: 'Empty', path: '/projects/empty' },
    ],
  }) })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['target-first', 'target-second'])
  const collapsedTarget = makeWorkspaceGroup('empty')
  const overflow = document.createElement('button')
  overflow.dataset.rowKey = 'overflow:empty'
  collapsedTarget.container.append(overflow)
  tree.append(collapsedTarget.container)

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  const sessionOver = dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover')
  assert.equal(sessionOver.defaultPrevented, true)
  assert.equal(targetGroup.container.getAttribute('data-dsw-drop-target'), 'true')
  const sessionDrop = dispatchDrag(app.dom, targetGroup.sessions[1].child, 'drop')
  assert.equal(sessionDrop.defaultPrevented, true)
  assert.equal(targetGroup.container.hasAttribute('data-dsw-drop-target'), false)
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new' },
  ])
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  const paddingOver = dispatchDrag(app.dom, targetGroup.padding, 'dragover')
  assert.equal(paddingOver.defaultPrevented, true)
  assert.equal(targetGroup.container.getAttribute('data-dsw-drop-target'), 'true')
  const paddingDrop = dispatchDrag(app.dom, targetGroup.padding, 'drop')
  assert.equal(paddingDrop.defaultPrevented, true)
  assert.equal(targetGroup.container.hasAttribute('data-dsw-drop-target'), false)
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new' },
    { sessionId: 'session-one', workspaceId: 'new' },
  ])

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  assert.equal(dispatchDrag(app.dom, collapsedTarget.padding, 'dragover').defaultPrevented, true)
  assert.equal(collapsedTarget.container.getAttribute('data-dsw-drop-target'), 'true')
  dispatchDrag(app.dom, collapsedTarget.padding, 'drop')
  await flush()
  assert.equal(app.calls.filter(call => call.method === 'move').at(-1).payload.workspaceId, 'empty',
    'a collapsed/empty group resolves its own header through the transparent wrapper')
})

test('workspace target resolution stays inside its public tree and does not infer a root target', async (t) => {
  const app = setup()
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const otherTree = createWorkspaceTree()
  const otherGroup = addWorkspaceGroup(otherTree, 'remote', ['remote-session'])
  const rootPadding = document.createElement('div')
  tree.append(rootPadding)

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  const crossTree = dispatchDrag(app.dom, otherGroup.sessions[0].child, 'dragover')
  assert.equal(crossTree.defaultPrevented, false)
  assert.equal(otherGroup.container.hasAttribute('data-dsw-drop-target'), false)
  const rootArea = dispatchDrag(app.dom, rootPadding, 'dragover')
  assert.equal(rootArea.defaultPrevented, false, 'the tree root does not fall back to its first workspace header')
  assert.equal(sourceGroup.container.hasAttribute('data-dsw-drop-target'), false)
  assert.equal(app.calls.some(call => call.method === 'move'), false)
})

test('nested workspace content resolves to its own header and flat-list rows are not workspace targets', async (t) => {
  const app = setup({ sessionState: state({
    workspaces: [
      { workspaceId: 'old', title: 'Old', path: '/projects/old' },
      { workspaceId: 'new', title: 'New', path: '/projects/new' },
      { workspaceId: 'parent', title: 'Parent', path: '/projects/parent' },
      { workspaceId: 'nested', title: 'Nested', path: '/projects/parent/nested' },
    ],
  }) })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const parentGroup = makeWorkspaceGroup('parent')
  const nestedGroup = makeWorkspaceGroup('nested', ['nested-session'])
  const nestedRows = document.createElement('div')
  nestedRows.setAttribute('role', 'group')
  nestedRows.append(nestedGroup.container)
  parentGroup.container.insertBefore(nestedRows, parentGroup.padding)
  tree.append(parentGroup.container)

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  const nestedOver = dispatchDrag(app.dom, nestedGroup.sessions[0].child, 'dragover')
  assert.equal(nestedOver.defaultPrevented, true)
  assert.equal(nestedGroup.container.getAttribute('data-dsw-drop-target'), 'true')
  assert.equal(parentGroup.container.hasAttribute('data-dsw-drop-target'), false, 'a nested role=group branch does not inherit its parent workspace')
  dispatchDrag(app.dom, nestedGroup.sessions[0].child, 'drop')
  await flush()
  assert.equal(app.calls.filter(call => call.method === 'move').at(-1).payload.workspaceId, 'nested')
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')

  const flatTree = createWorkspaceTree()
  const flatSource = document.createElement('div')
  flatSource.dataset.rowKey = 'session:flat-source'
  flatSource.setAttribute('role', 'treeitem')
  const flatSourceWrapper = document.createElement('span')
  flatSourceWrapper.append(flatSource)
  const flatTarget = document.createElement('div')
  flatTarget.dataset.rowKey = 'session:flat-target'
  flatTarget.setAttribute('role', 'treeitem')
  const flatTargetChild = document.createElement('span')
  flatTarget.append(flatTargetChild)
  const flatTargetWrapper = document.createElement('span')
  flatTargetWrapper.append(flatTarget)
  flatTree.append(flatSourceWrapper, flatTargetWrapper)

  dispatchDrag(app.dom, flatSource, 'dragstart')
  await flush()
  const flatOver = dispatchDrag(app.dom, flatTargetChild, 'dragover')
  assert.equal(flatOver.defaultPrevented, false, 'flat session rows without a workspace sibling stay with native reorder')
  assert.equal(app.calls.filter(call => call.method === 'move').length, 1)
})

test('cross-workspace targeting hides the source reorder marker only for the accepted target and cleans up', async (t) => {
  const app = setup()
  let disposed = false
  t.after(() => { if (!disposed) app.teardown() })

  const tree = createWorkspaceTree()
  const sourceWorkspace = addWorkspaceGroup(tree, 'old', ['session-one', 'source-warm-row'])
  const targetWorkspace = addWorkspaceGroup(tree, 'new', ['target-session'])
  const source = sourceWorkspace.sessions[0].row
  const siblingMarker = sourceWorkspace.sessions[1].row
  source.className = 'host-session-row host-drop-before host-drop-after'
  siblingMarker.className = 'host-session-row host-drop-before'
  const outside = document.createElement('div')
  document.body.append(outside)
  const otherTree = createWorkspaceTree()
  const unrelated = addWorkspaceGroup(otherTree, 'unrelated', ['unrelated-session'])
  const unrelatedSession = unrelated.sessions[0].row

  let sourceWorkspaceDragOver = false
  sourceWorkspace.header.addEventListener('dragover', () => { sourceWorkspaceDragOver = true })
  const activeTreeSelector = '[role="tree"][data-dsw-cross-workspace-drop-active="true"]'
  const hiddenMarkerSelector = `${activeTreeSelector} [data-row-key^="session:"]`
  const styles = document.getElementById('dsh-session-workspace-style').textContent
  assert.ok(styles.includes(`${hiddenMarkerSelector}::before`))
  assert.ok(styles.includes(`${hiddenMarkerSelector}::after`))

  dispatchDrag(app.dom, source, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetWorkspace.sessions[0].child, 'dragover')
  assert.equal(tree.getAttribute('data-dsw-cross-workspace-drop-active'), 'true')
  assert.deepEqual(Array.from(document.querySelectorAll(hiddenMarkerSelector)), [source, siblingMarker, targetWorkspace.sessions[0].row],
    'the tree-scoped override also matches the sibling source marker row and target-group session rows')
  assert.equal(source.classList.contains('host-drop-after'), true)
  assert.equal(siblingMarker.classList.contains('host-drop-before'), true, 'host marker classes remain intact while the scoped CSS hides both marker rows')
  assert.equal(unrelatedSession.matches(hiddenMarkerSelector), false, 'other sidebar trees are not hidden')
  assert.equal(targetWorkspace.container.getAttribute('data-dsw-drop-target'), 'true')

  const backToSource = dispatchDrag(app.dom, sourceWorkspace.headerChild, 'dragover')
  assert.equal(tree.hasAttribute('data-dsw-cross-workspace-drop-active'), false)
  assert.equal(backToSource.defaultPrevented, false)
  assert.equal(sourceWorkspaceDragOver, true, 'returning to Source leaves host drag handling enabled')
  assert.equal(source.classList.contains('host-drop-after'), true)
  assert.equal(siblingMarker.classList.contains('host-drop-before'), true)
  assert.equal(targetWorkspace.container.hasAttribute('data-dsw-drop-target'), false)

  dispatchDrag(app.dom, targetWorkspace.sessions[0].child, 'dragover')
  assert.equal(tree.getAttribute('data-dsw-cross-workspace-drop-active'), 'true')
  dispatchDrag(app.dom, outside, 'dragover')
  assert.equal(tree.hasAttribute('data-dsw-cross-workspace-drop-active'), false, 'leaving the target restores the native marker')

  dispatchDrag(app.dom, targetWorkspace.sessions[0].child, 'dragover')
  assert.equal(tree.getAttribute('data-dsw-cross-workspace-drop-active'), 'true')
  dispatchDrag(app.dom, source, 'dragend')
  assert.equal(tree.hasAttribute('data-dsw-cross-workspace-drop-active'), false)
  assert.equal(source.classList.contains('host-drop-after'), true)
  assert.equal(siblingMarker.classList.contains('host-drop-before'), true)

  dispatchDrag(app.dom, source, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetWorkspace.sessions[0].child, 'dragover')
  assert.equal(tree.getAttribute('data-dsw-cross-workspace-drop-active'), 'true')
  app.teardown()
  disposed = true
  assert.equal(tree.hasAttribute('data-dsw-cross-workspace-drop-active'), false, 'plugin cleanup removes the tree-scoped marker override')
  assert.equal(source.classList.contains('host-drop-after'), true)
  assert.equal(siblingMarker.classList.contains('host-drop-before'), true)
})

test('dragging an active session displays the backend safety reason without accepting a drop', async (t) => {
  const app = setup({ sessionState: state({ active: true }) })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new')

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  assert.match(document.querySelector('[role="alert"]').textContent, /session is still active/i)
  const over = dispatchDrag(app.dom, targetGroup.headerChild, 'dragover')
  assert.equal(over.defaultPrevented, false)
  assert.equal(app.calls.some(call => call.method === 'move'), false)
})

test('a backend rejection after a drag is shown as a visible move error', async (t) => {
  const app = setup({ moveResult: { ok: false, error: { code: 'session-active', message: 'session became active' } } })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new')

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.headerChild, 'dragover')
  dispatchDrag(app.dom, targetGroup.headerChild, 'drop')
  await flush()
  assert.match(document.querySelector('[role="alert"]').textContent, /session became active/)
})

test('same-workspace reorder and workspace-row drag are left to the host', async (t) => {
  const app = setup()
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one', 'session-two'])
  const targetGroup = addWorkspaceGroup(tree, 'new')
  let hostSessionDragOver = false
  sourceGroup.sessions[1].row.addEventListener('dragover', () => { hostSessionDragOver = true })

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  assert.equal(dispatchDrag(app.dom, sourceGroup.sessions[0].child, 'dragover').defaultPrevented, false)
  const sameWorkspaceOver = dispatchDrag(app.dom, sourceGroup.sessions[1].child, 'dragover')
  assert.equal(sameWorkspaceOver.defaultPrevented, false)
  assert.equal(hostSessionDragOver, true, 'same-workspace session drag stays available to the host')
  assert.equal(dispatchDrag(app.dom, sourceGroup.sessions[1].child, 'drop').defaultPrevented, false)
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')

  hostSessionDragOver = false
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  const pendingSameWorkspaceOver = dispatchDrag(app.dom, sourceGroup.sessions[1].child, 'dragover')
  assert.equal(pendingSameWorkspaceOver.defaultPrevented, false, 'same-workspace reorder remains native while state RPC is pending')
  assert.equal(hostSessionDragOver, true)
  assert.equal(dispatchDrag(app.dom, sourceGroup.sessions[1].child, 'drop').defaultPrevented, false)
  await flush()
  assert.equal(app.calls.some(call => call.method === 'move'), false)
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')

  const callsBeforeWorkspaceDrag = app.calls.length
  dispatchDrag(app.dom, sourceGroup.header, 'dragstart')
  assert.equal(app.calls.length, callsBeforeWorkspaceDrag)
  assert.equal(dispatchDrag(app.dom, targetGroup.headerChild, 'dragover').defaultPrevented, false)
  assert.equal(app.calls.some(call => call.method === 'move'), false)
})

test('apply cleanup removes slot registration, styles, and global drag handlers', () => {
  const app = setup()
  const localDocument = app.dom.window.document
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const before = app.calls.length
  const cleaned = app.teardown()
  assert.deepEqual(cleaned, { registrationRemoved: true, localeRemoved: true })
  assert.equal(localDocument.getElementById('dsh-session-workspace-style'), null)
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  assert.equal(app.calls.length, before)
})
