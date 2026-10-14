import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'

import { apply } from '../src/client.js'

const state = (overrides = {}) => ({
  sessionId: 'session-one',
  currentWorkspaceId: 'old',
  currentPath: '/projects/old',
  active: false,
  warmMoveSupported: false,
  busy: false,
  supported: true,
  positionSupported: true,
  workspaces: [
    { workspaceId: 'old', title: 'Old', path: '/projects/old' },
    { workspaceId: 'new', title: 'New', path: '/projects/new' },
  ],
  ...overrides,
})

function nativeSession(id, updatedAt, overrides = {}) {
  return { id, updatedAt, blank: false, origin: 'main', retainedBy: {}, ...overrides }
}

function nativeOrderFixture({
  orderBy = 'updated',
  sessionOrderByAccount = {},
  items = [
    { workspaceId: 'old', sessionIds: ['session-one'] },
    { workspaceId: 'new', sessionIds: ['target-first', 'target-second'] },
  ],
  sessions = [
    nativeSession('session-one', 100),
    nativeSession('target-first', 300),
    nativeSession('target-second', 200),
  ],
  pinnedSessionIds = [],
  archivedSessionIds = [],
  archivedFilter = 'default',
} = {}) {
  const byId = Object.fromEntries(sessions.map(summary => [summary.id, summary]))
  return {
    view: { orderBy, sessionOrderByAccount, archivedFilter },
    workspaces: { phase: 'ready', state: 'ready', items, pinnedSessionIds, archivedSessionIds },
    sessions: { phase: 'ready', ids: sessions.map(summary => summary.id), byId },
  }
}

function withoutPositionSupport(value) {
  const copy = { ...value }
  delete copy.positionSupported
  return copy
}

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
  'reason.session-active': 'This session is loaded and the backend cannot move loaded sessions.',
  'reason.session-busy': 'This session has running or queued work. Wait until it is idle; moving will not stop it.',
  'reason.unsupported': 'This DSH version or persistence backend cannot move sessions safely.',
  'reason.no-targets': 'No other workspace is available.',
  'error.load': 'Could not load workspaces: {message}',
  'error.move': 'Move failed: {message}',
  'error.already-moving': 'A move for this session is already in progress.',
  'error.order-unavailable': 'Native sidebar order unavailable; the session was not moved.',
  'error.order-boundary': 'The fixed sidebar section cannot honor this insertion; the session was not moved.',
  'error.position-unsupported': 'The backend does not support row insertion; reload this plugin.',
  'error.order-save': 'The session moved, but its sidebar position could not be saved: {message}',
  'error.view-unavailable': 'The current session view cannot be verified or released; no move was sent.',
  'error.view-release': 'Another component still retains this session, so it was not moved.',
  'error.move-restore': 'The move failed: {moveMessage}; the original session view could not be restored: {restoreMessage}',
  'error.view-restore': 'The session moved, but its view could not be refreshed and reopened: {message}',
}

function translator(key, values = {}) {
  return Object.entries(values).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, replacement), messages[key] ?? key)
}

function setup({ sessionState = state(), moveResult = { ok: true }, slotSnapshot = [{ name: 'sidebar.workspaces.session.menu.item' }], omitSnapshot = false, nativeOrderState, nativeOrderActionError, mainViewSessionId, missingClearMain = false, missingRetainInfo = false, retainAfterClear = false, clearMainError, retentionErrorAfterClearOnce = false, refreshError } = {}) {
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
  const lifecycle = []
  let registration
  let registrationRemoved = false
  let localeRemoved = false
  const disposers = []
  const nativeOrders = []
  let nativeViewSnapshot = nativeOrderState?.view
  const nativeView = nativeOrderState === undefined ? undefined : {
    getSnapshot: () => nativeViewSnapshot,
    actions: {
      setSessionOrder(accountKey, order, initialOrders) {
        const copiedOrders = Object.fromEntries(Object.entries(initialOrders).map(([key, ids]) => [key, [...ids]]))
        nativeOrders.push({ accountKey, order: [...order], initialOrders: copiedOrders })
        lifecycle.push('setSessionOrder')
        if (nativeOrderActionError !== undefined) throw new Error(nativeOrderActionError)
        nativeViewSnapshot = {
          ...nativeViewSnapshot,
          orderBy: 'manual',
          sessionOrderByAccount: { ...copiedOrders, [accountKey]: [...order] },
        }
      },
    },
  }
  const nativeStore = nativeView === undefined ? undefined : {
    spec: { persist: 'dsh.workspace.view.v5' },
    create: () => nativeView,
  }
  let selectedMainSessionId = mainViewSessionId
  let overrideMainView = mainViewSessionId !== undefined
  let postClearRetained = false
  let clearAttempted = false
  let retentionErrorThrown = false
  const coldSummary = nativeSession(sessionState.sessionId, 0)
  delete coldSummary.retainedBy
  const defaultSessions = {
    phase: 'ready',
    ids: [sessionState.sessionId],
    byId: { [sessionState.sessionId]: coldSummary },
  }
  const currentSessionSnapshot = () => {
    const base = nativeOrderState?.sessions ?? defaultSessions
    if (!overrideMainView) return base
    const ids = [...base.ids]
    const byId = Object.fromEntries(Object.entries(base.byId).map(([id, summary]) => [id, {
      ...summary,
      retainedBy: { ...(summary.retainedBy ?? {}), mainView: selectedMainSessionId === id ? 1 : 0 },
    }]))
    if (selectedMainSessionId !== undefined && byId[selectedMainSessionId] === undefined) {
      ids.push(selectedMainSessionId)
      byId[selectedMainSessionId] = nativeSession(selectedMainSessionId, 0, { retainedBy: { mainView: 1 } })
    }
    return { ...base, ids, byId }
  }
  const sessions = {
    list: { getSnapshot: currentSessionSnapshot },
    ...(!missingRetainInfo ? {
      retainInfo(id) {
        return {
          getSnapshot() {
            if (clearAttempted && retentionErrorAfterClearOnce && !retentionErrorThrown) {
              retentionErrorThrown = true
              throw new Error('retention snapshot temporarily unavailable')
            }
            const summary = currentSessionSnapshot().byId[id]
            const retainedBy = summary?.retainedBy ?? {}
            const referenceCount = Object.values(retainedBy).reduce((sum, count) => sum + (Number.isSafeInteger(count) ? count : 0), 0)
              + (postClearRetained && id === mainViewSessionId ? 1 : 0)
            return { referenceCount, retainedBy }
          },
        }
      },
    } : {}),
    async refresh() {
      lifecycle.push('refresh')
      if (refreshError !== undefined) throw new Error(refreshError)
    },
  }
  const uiWorkspace = {
    ...(!missingClearMain ? {
      clearMain() {
        lifecycle.push('clearMain')
        clearAttempted = true
        overrideMainView = true
        selectedMainSessionId = undefined
        postClearRetained = retainAfterClear
        if (clearMainError !== undefined) throw new Error(clearMainError)
      },
    } : {}),
    openSession(id) {
      lifecycle.push(`openSession:${id}`)
      overrideMainView = true
      selectedMainSessionId = id
      postClearRetained = false
    },
  }
  const sessionService = sessions
  const ctx = {
    get(name) {
      if (name === 'slots') return this.slots
      if (name === 'sessions') return sessionService
      if (name === 'uiWorkspace') return uiWorkspace
      if (name === 'workspaces' && nativeOrderState !== undefined) return { list: { getSnapshot: () => nativeOrderState.workspaces } }
      if (name === 'sessions' && nativeOrderState !== undefined) return { list: { getSnapshot: () => nativeOrderState.sessions } }
      return undefined
    },
    connection: {
      rpc: {
        async call(path, method, payload) {
          calls.push({ path, method, payload })
          if (method === 'state') return { ok: true, value: { ...sessionState, sessionId: payload.sessionId } }
          lifecycle.push('move')
          return typeof moveResult === 'function' ? moveResult(payload) : moveResult
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
      entriesOfSlot(key) {
        assert.equal(key, 'sidebar.workspaces')
        return nativeStore === undefined ? [] : [{ store: nativeStore }]
      },
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
    nativeOrders,
    disposers,
    registration: () => registration,
    lifecycle,
    selectMainSession(id) {
      lifecycle.push(`user-select:${id}`)
      overrideMainView = true
      selectedMainSessionId = id
      postClearRetained = false
    },
    mainSession: () => selectedMainSessionId,
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

function dispatchDrag(dom, target, type, dataTransfer = { dropEffect: 'none' }, coordinates = {}) {
  const event = new dom.window.MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: coordinates.clientX ?? 0,
    clientY: coordinates.clientY ?? 0,
  })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  target.dispatchEvent(event)
  return event
}

function setRect(element, { left, top, width, height }) {
  element.getBoundingClientRect = () => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  })
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

async function openMenuDialog(app, sessionId = 'session-one') {
  const registered = app.registration()
  const moveSession = registered.config.inject().moveSession
  const button = registered.component({
    sessionId,
    displayTitle: 'A conversation',
    useMenuOpenState: () => [true, () => {}],
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
  return document.querySelector('[role="dialog"]')
}

test('the official session menu slot opens the workspace chooser and moves the same session ID', async (t) => {
  const app = setup({ sessionState: withoutPositionSupport(state()) })
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

test('moving an opened idle main session from the menu releases and reopens the same ID', async (t) => {
  const app = setup({
    sessionState: state({ active: true, warmMoveSupported: true }),
    mainViewSessionId: 'session-one',
  })
  t.after(() => app.teardown())

  const dialog = await openMenuDialog(app)
  assert.equal(dialog.querySelector('.dsw-primary').disabled, false)
  dialog.querySelector('.dsw-primary').click()
  await flush()

  assert.deepEqual(app.lifecycle, ['clearMain', 'move', 'refresh', 'openSession:session-one'])
  assert.equal(app.mainSession(), 'session-one')
  assert.deepEqual(app.calls.filter(call => call.method === 'move').at(-1).payload,
    { sessionId: 'session-one', workspaceId: 'new' })
  await new Promise(resolve => setTimeout(resolve, 710))
})

test('precise drag of an opened idle main session releases, moves, reorders, refreshes, and reopens', async (t) => {
  const app = setup({
    sessionState: state({ active: true, warmMoveSupported: true }),
    nativeOrderState: nativeOrderFixture(),
    mainViewSessionId: 'session-one',
  })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['target-first', 'target-second'])
  setRect(targetGroup.sessions[0].row, { left: 40, top: 100, width: 280, height: 32 })

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 104 })
  assert.equal(document.querySelector('.dsw-session-drop-marker')?.dataset.side, 'before')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 104 })
  await flush()

  assert.deepEqual(app.lifecycle, ['clearMain', 'move', 'setSessionOrder', 'refresh', 'openSession:session-one'])
  assert.equal(app.mainSession(), 'session-one')
  assert.deepEqual(app.calls.filter(call => call.method === 'move').at(-1).payload,
    { sessionId: 'session-one', workspaceId: 'new', position: { anchorSessionId: 'target-first', side: 'before' } })
  assert.deepEqual(app.nativeOrders[0].order, ['session-one', 'target-first', 'target-second'])
})

test('a rejected move restores the opened main session', async (t) => {
  const rejected = setup({
    sessionState: state({ active: true, warmMoveSupported: true }),
    moveResult: { ok: false, error: { message: 'backend refused the move' } },
    mainViewSessionId: 'session-one',
  })
  t.after(() => rejected.teardown())
  const dialog = await openMenuDialog(rejected)
  dialog.querySelector('.dsw-primary').click()
  await flush()
  assert.deepEqual(rejected.lifecycle, ['clearMain', 'move', 'openSession:session-one'])
  assert.equal(rejected.mainSession(), 'session-one')
  assert.match(dialog.querySelector('.dsw-status').textContent, /backend refused the move/)
})

test('a user selection during an opened-session move is never overwritten on completion', async (t) => {
  let resolveMove
  const pendingMove = new Promise(resolve => { resolveMove = resolve })
  const steered = setup({
    sessionState: state({ active: true, warmMoveSupported: true }),
    moveResult: () => pendingMove,
    mainViewSessionId: 'session-one',
  })
  t.after(() => steered.teardown())
  const pendingDialog = await openMenuDialog(steered)
  pendingDialog.querySelector('.dsw-primary').click()
  await flush()
  assert.deepEqual(steered.lifecycle, ['clearMain', 'move'])
  steered.selectMainSession('user-selected-session')
  resolveMove({ ok: true })
  await flush()
  assert.deepEqual(steered.lifecycle,
    ['clearMain', 'move', 'user-select:user-selected-session', 'refresh'])
  assert.equal(steered.mainSession(), 'user-selected-session', 'completion must not reclaim the view after user navigation')
  await new Promise(resolve => setTimeout(resolve, 710))
})

test('moving a non-current loaded session leaves the current view unchanged', async (t) => {
  const app = setup({
    sessionState: state({ active: true, warmMoveSupported: true }),
    mainViewSessionId: 'already-open-session',
  })
  t.after(() => app.teardown())
  const dialog = await openMenuDialog(app)
  dialog.querySelector('.dsw-primary').click()
  await flush()

  assert.deepEqual(app.lifecycle, ['move', 'refresh'])
  assert.equal(app.mainSession(), 'already-open-session')
  assert.equal(app.calls.some(call => call.method === 'move'), true)
  await new Promise(resolve => setTimeout(resolve, 710))
})

test('a current cold session also requires the backend release capability before clearMain', async (t) => {
  const app = setup({
    sessionState: state({ active: false, warmMoveSupported: false }),
    mainViewSessionId: 'session-one',
  })
  t.after(() => app.teardown())
  const dialog = await openMenuDialog(app)
  assert.equal(dialog.querySelector('.dsw-primary').disabled, false, 'cold state is permitted by the general move model')
  dialog.querySelector('.dsw-primary').click()
  await flush()

  assert.match(dialog.querySelector('.dsw-status').textContent, /cannot be verified or released/i)
  assert.deepEqual(app.lifecycle, [], 'the internal clearMain seam is never called without the backend capability')
  assert.equal(app.calls.some(call => call.method === 'move'), false)
  assert.equal(app.mainSession(), 'session-one')
})

test('the menu refuses a busy or queued session without clearing the view or cancelling work', async (t) => {
  const menuApp = setup({
    sessionState: state({ active: true, warmMoveSupported: true, busy: true }),
    mainViewSessionId: 'session-one',
  })
  t.after(() => menuApp.teardown())
  const dialog = await openMenuDialog(menuApp)
  assert.match(dialog.querySelector('.dsw-status').textContent, /running or queued work/i)
  assert.equal(dialog.querySelector('.dsw-primary').disabled, true)
  assert.deepEqual(menuApp.lifecycle, [])
  assert.equal(menuApp.calls.some(call => call.method === 'cancel'), false)
})

test('drag refuses a busy or queued session without clearing the view or cancelling work', async (t) => {
  const dragApp = setup({
    sessionState: state({ active: true, warmMoveSupported: true, busy: true }),
    mainViewSessionId: 'session-one',
  })
  t.after(() => dragApp.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new')
  dispatchDrag(dragApp.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  assert.match(document.querySelector('[role="alert"]').textContent, /running or queued work/i)
  const over = dispatchDrag(dragApp.dom, targetGroup.headerChild, 'dragover')
  assert.equal(over.defaultPrevented, false)
  dispatchDrag(dragApp.dom, targetGroup.headerChild, 'drop')
  await flush()
  assert.equal(dragApp.calls.some(call => call.method === 'move' || call.method === 'cancel'), false)
  assert.equal(dragApp.mainSession(), 'session-one')
  assert.deepEqual(dragApp.lifecycle, [])
})

test('current-session move fails closed when the Native release seam or retention accounting is unavailable', async (t) => {
  for (const options of [{ missingClearMain: true }, { missingRetainInfo: true }, { retainAfterClear: true }]) {
    const app = setup({
      sessionState: state({ active: true, warmMoveSupported: true }),
      mainViewSessionId: 'session-one',
      ...options,
    })
    const dialog = await openMenuDialog(app)
    dialog.querySelector('.dsw-primary').click()
    await flush()
    assert.equal(app.calls.some(call => call.method === 'move'), false, JSON.stringify(options))
    assert.ok(dialog.querySelector('.dsw-status').textContent.length > 0)
    if (options.retainAfterClear) {
      assert.deepEqual(app.lifecycle, ['clearMain', 'openSession:session-one'])
      assert.equal(app.mainSession(), 'session-one')
    } else {
      assert.deepEqual(app.lifecycle, [])
    }
    app.teardown()
  }
})

test('a clearMain exception restores the original main view and prevents migration', async (t) => {
  const app = setup({
    sessionState: state({ active: true, warmMoveSupported: true }),
    mainViewSessionId: 'session-one',
    clearMainError: 'clearMain failed after releasing',
  })
  t.after(() => app.teardown())
  const dialog = await openMenuDialog(app)
  dialog.querySelector('.dsw-primary').click()
  await flush()

  assert.deepEqual(app.lifecycle, ['clearMain', 'openSession:session-one'])
  assert.equal(app.mainSession(), 'session-one')
  assert.equal(app.calls.some(call => call.method === 'move'), false)
  assert.match(dialog.querySelector('.dsw-status').textContent, /clearMain failed after releasing/)
})

test('a transient retention snapshot failure after clear restores before any move RPC', async (t) => {
  const app = setup({
    sessionState: state({ active: true, warmMoveSupported: true }),
    mainViewSessionId: 'session-one',
    retentionErrorAfterClearOnce: true,
  })
  t.after(() => app.teardown())
  const dialog = await openMenuDialog(app)
  dialog.querySelector('.dsw-primary').click()
  await flush()

  assert.deepEqual(app.lifecycle, ['clearMain', 'openSession:session-one'])
  assert.equal(app.mainSession(), 'session-one')
  assert.equal(app.calls.some(call => call.method === 'move'), false)
  assert.match(dialog.querySelector('.dsw-status').textContent, /retention snapshot temporarily unavailable/)
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
  assert.deepEqual(app.calls.filter(call => call.method === 'move').at(-1).payload,
    { sessionId: 'session-one', workspaceId: 'empty' },
    'a collapsed/empty group resolves its own header through the transparent wrapper without inventing an anchor')
})

test('cross-workspace session boundaries show a plugin marker and send matching placement', async (t) => {
  const app = setup({ nativeOrderState: nativeOrderFixture({
    items: [
      { workspaceId: 'old', sessionIds: ['session-one', 'old-hidden', 'current-blank'] },
      { workspaceId: 'new', sessionIds: ['target-first', 'hidden-archive', 'target-second'] },
    ],
    sessions: [
      nativeSession('session-one', 700),
      nativeSession('old-hidden', 500),
      nativeSession('current-blank', 1100, { blank: true, retainedBy: { mainView: 1 } }),
      nativeSession('target-first', 900),
      nativeSession('hidden-archive', 850),
      nativeSession('target-second', 800),
      nativeSession('subagent-one', 400, { origin: 'subagent' }),
      nativeSession('loose-one', 400),
      nativeSession('blank-other', 200, { blank: true }),
    ],
    archivedSessionIds: ['hidden-archive'],
  }) })
  let disposed = false
  t.after(() => { if (!disposed) app.teardown() })
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['target-first', 'target-second'])
  setRect(sourceGroup.sessions[0].row, { left: 40, top: 40, width: 280, height: 32 })
  setRect(targetGroup.sessions[0].row, { left: 40, top: 100, width: 280, height: 32 })
  setRect(targetGroup.sessions[1].row, { left: 40, top: 140, width: 280, height: 32 })
  const styles = document.getElementById('dsh-session-workspace-style').textContent
  assert.ok(styles.includes('.dsw-session-drop-marker'))
  assert.ok(styles.includes('pointer-events:none'))
  assert.ok(styles.includes('var(--dsw-alias-state-business-primary)'))

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  const upperDrop = dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  assert.equal(upperDrop.defaultPrevented, true)
  const marker = document.querySelector('.dsw-session-drop-marker')
  assert.ok(marker)
  assert.equal(marker.dataset.side, 'before')
  assert.equal(marker.style.left, '40px')
  assert.equal(marker.style.top, '93px')
  assert.equal(marker.style.width, '280px')
  assert.equal(marker.parentElement, document.body, 'the plugin marker sits outside the source tree pseudo-marker suppression')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 108 })
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null)
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new', position: { anchorSessionId: 'target-first', side: 'before' } },
  ])
  assert.deepEqual(app.nativeOrders[0], {
    accountKey: 'new',
    order: ['session-one', 'target-first', 'hidden-archive', 'target-second'],
    initialOrders: {
      old: ['current-blank', 'old-hidden'],
      new: ['session-one', 'target-first', 'hidden-archive', 'target-second'],
      '': ['loose-one', 'subagent-one', 'blank-other'],
      __flat_session_order__: ['current-blank', 'target-first', 'hidden-archive', 'target-second', 'session-one', 'old-hidden', 'loose-one'],
    },
  }, 'the shared Native action receives complete orders, including hidden archive/blank/fork members, and removes the moved ID only from its source account')
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[1].child, 'dragover', undefined, { clientY: 169 })
  const lowerMarker = document.querySelector('.dsw-session-drop-marker')
  assert.ok(lowerMarker)
  assert.equal(lowerMarker.dataset.side, 'after')
  assert.equal(lowerMarker.style.top, '167px')
  dispatchDrag(app.dom, targetGroup.sessions[1].child, 'drop', undefined, { clientY: 169 })
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null)
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new', position: { anchorSessionId: 'target-first', side: 'before' } },
    { sessionId: 'session-one', workspaceId: 'new', position: { anchorSessionId: 'target-second', side: 'after' } },
  ])
  assert.deepEqual(app.nativeOrders[1].order, ['target-first', 'hidden-archive', 'target-second', 'session-one'],
    'manual order normalization retains the hidden archive and inserts after the selected UI anchor')
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  assert.ok(document.querySelector('.dsw-session-drop-marker'))
  const sameWorkspace = dispatchDrag(app.dom, sourceGroup.sessions[0].child, 'dragover', undefined, { clientY: 55 })
  assert.equal(sameWorkspace.defaultPrevented, false)
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null, 'returning to the source workspace restores native reorder cues')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  dispatchDrag(app.dom, targetGroup.headerChild, 'dragover')
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null, 'header targeting clears the row insertion marker')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  dispatchDrag(app.dom, targetGroup.padding, 'dragover')
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null, 'header/padding targeting has no row boundary')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null, 'dragend clears the plugin marker')

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  assert.ok(document.querySelector('.dsw-session-drop-marker'))
  const localDocument = app.dom.window.document
  app.teardown()
  disposed = true
  assert.equal(localDocument.querySelector('.dsw-session-drop-marker'), null, 'plugin cleanup removes the marker element')
})

test('Native fixed sections reject impossible boundaries and preserve the normal-after-last-pin boundary', async (t) => {
  const app = setup({ nativeOrderState: nativeOrderFixture({
    items: [
      { workspaceId: 'old', sessionIds: ['session-one'] },
      { workspaceId: 'new', sessionIds: ['blank-target', 'pin-first', 'pin-last', 'normal-first', 'normal-last'] },
    ],
    sessions: [
      nativeSession('blank-target', 1000, { blank: true, retainedBy: { mainView: 1 } }),
      nativeSession('pin-first', 900),
      nativeSession('pin-last', 800),
      nativeSession('normal-first', 700),
      nativeSession('normal-last', 600),
      nativeSession('session-one', 500),
    ],
    pinnedSessionIds: ['pin-first', 'pin-last'],
  }) })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['blank-target', 'pin-first', 'pin-last', 'normal-first', 'normal-last'])
  for (const [index, session] of targetGroup.sessions.entries()) {
    setRect(session.row, { left: 40, top: 40 + index * 40, width: 280, height: 32 })
  }

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 66 })
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null,
    'a normal session cannot appear between the blank and pinned sections')
  assert.equal(dispatchDrag(app.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 66 }).defaultPrevented, true)
  await flush()
  assert.equal(app.calls.some(call => call.method === 'move'), false, 'an impossible row boundary is rejected before backend migration')
  assert.match(document.querySelector('[role="alert"]').textContent, /fixed sidebar section/)
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[2].child, 'dragover', undefined, { clientY: 145 })
  assert.equal(document.querySelector('.dsw-session-drop-marker')?.dataset.side, 'after')
  dispatchDrag(app.dom, targetGroup.sessions[2].child, 'drop', undefined, { clientY: 145 })
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new', position: { anchorSessionId: 'pin-last', side: 'after' } },
  ])
  assert.deepEqual(app.nativeOrders[0].order,
    ['blank-target', 'pin-first', 'pin-last', 'session-one', 'normal-first', 'normal-last'],
    'the public store action places the normal session first in the ordinary section')
})

test('manual native orders retain saved unknown members and append unsaved members without summaries', async (t) => {
  const app = setup({ nativeOrderState: nativeOrderFixture({
    orderBy: 'manual',
    items: [
      { workspaceId: 'old', sessionIds: ['session-one', 'old-hidden'] },
      { workspaceId: 'new', sessionIds: ['target-first', 'hidden-archive', 'target-second', 'target-fork', 'pending-saved', 'pending-unseeded'] },
    ],
    sessions: [
      nativeSession('session-one', 100),
      nativeSession('old-hidden', 90),
      nativeSession('target-first', 80),
      nativeSession('hidden-archive', 70),
      nativeSession('target-second', 60),
      nativeSession('target-fork', 110, { parentId: 'target-first' }),
    ],
    sessionOrderByAccount: {
      old: ['session-one', 'old-hidden', 'stale-no-longer-member'],
      new: ['target-second', 'pending-saved', 'hidden-archive', 'target-first'],
      '': [],
      __flat_session_order__: ['session-one', 'target-second', 'hidden-archive', 'target-first', 'old-hidden'],
    },
    archivedSessionIds: ['hidden-archive'],
  }) })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['target-second', 'target-fork', 'target-first'])
  setRect(targetGroup.sessions[0].row, { left: 40, top: 100, width: 280, height: 32 })

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  assert.equal(document.querySelector('.dsw-session-drop-marker')?.dataset.side, 'before')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 108 })
  await flush()
  assert.deepEqual(app.nativeOrders[0].order,
    ['session-one', 'target-second', 'pending-saved', 'hidden-archive', 'target-fork', 'target-first', 'pending-unseeded'],
    'manual relative order, fork-before-parent placement, saved members without summaries, and newly observed Host members all survive')
  assert.equal(app.nativeOrders[0].initialOrders.old.includes('stale-no-longer-member'), false,
    'stale entries that are no longer account members are normalized away')
  assert.deepEqual(app.calls.filter(call => call.method === 'move').at(-1).payload,
    { sessionId: 'session-one', workspaceId: 'new', position: { anchorSessionId: 'target-second', side: 'before' } })
})

test('a normal session can be inserted after the blank row when the target has no pins', async (t) => {
  const app = setup({ nativeOrderState: nativeOrderFixture({
    items: [
      { workspaceId: 'old', sessionIds: ['session-one'] },
      { workspaceId: 'new', sessionIds: ['blank-target', 'normal-first', 'normal-last'] },
    ],
    sessions: [
      nativeSession('blank-target', 1000, { blank: true, retainedBy: { mainView: 1 } }),
      nativeSession('normal-first', 900),
      nativeSession('normal-last', 800),
      nativeSession('session-one', 700),
    ],
  }) })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['blank-target', 'normal-first', 'normal-last'])
  targetGroup.sessions.forEach((session, index) => setRect(session.row, { left: 40, top: 40 + index * 40, width: 280, height: 32 }))

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 66 })
  assert.equal(document.querySelector('.dsw-session-drop-marker')?.dataset.side, 'after')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 66 })
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').at(-1).payload,
    { sessionId: 'session-one', workspaceId: 'new', position: { anchorSessionId: 'blank-target', side: 'after' } })
  assert.deepEqual(app.nativeOrders[0].order, ['blank-target', 'session-one', 'normal-first', 'normal-last'])
})

test('a pinned source can be inserted immediately before the first ordinary target row', async (t) => {
  const app = setup({ nativeOrderState: nativeOrderFixture({
    items: [
      { workspaceId: 'old', sessionIds: ['pinned-source'] },
      { workspaceId: 'new', sessionIds: ['pin-first', 'pin-last', 'normal-first', 'normal-last'] },
    ],
    sessions: [
      nativeSession('normal-first', 1000),
      nativeSession('pin-first', 900),
      nativeSession('pin-last', 800),
      nativeSession('normal-last', 700),
      nativeSession('pinned-source', 600),
    ],
    pinnedSessionIds: ['pinned-source', 'pin-first', 'pin-last'],
  }) })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['pinned-source'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['pin-first', 'pin-last', 'normal-first', 'normal-last'])
  targetGroup.sessions.forEach((session, index) => setRect(session.row, { left: 40, top: 40 + index * 40, width: 280, height: 32 }))

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[2].child, 'dragover', undefined, { clientY: 124 })
  assert.equal(document.querySelector('.dsw-session-drop-marker')?.dataset.side, 'before')
  dispatchDrag(app.dom, targetGroup.sessions[2].child, 'drop', undefined, { clientY: 124 })
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').at(-1).payload,
    { sessionId: 'pinned-source', workspaceId: 'new', position: { anchorSessionId: 'normal-first', side: 'before' } })
  assert.deepEqual(app.nativeOrders[0].order,
    ['normal-first', 'pin-first', 'pin-last', 'pinned-source', 'normal-last'],
    'the native pinned projection renders the new pin after the existing pins and before ordinary sessions')
})

test('a session-row position fails visibly before migration when the public Native view is unavailable', async (t) => {
  const app = setup()
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['target-first'])
  setRect(targetGroup.sessions[0].row, { left: 40, top: 100, width: 280, height: 32 })

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null)
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 108 })
  await flush()
  assert.equal(app.calls.some(call => call.method === 'move'), false)
  assert.match(document.querySelector('[role="alert"]').textContent, /Native sidebar order unavailable/)
})

test('an older backend without positionSupported rejects row placement but keeps header moves', async (t) => {
  const app = setup({
    sessionState: withoutPositionSupport(state()),
    nativeOrderState: nativeOrderFixture(),
  })
  t.after(() => app.teardown())
  const tree = createWorkspaceTree()
  const sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  const targetGroup = addWorkspaceGroup(tree, 'new', ['target-first'])
  setRect(targetGroup.sessions[0].row, { left: 40, top: 100, width: 280, height: 32 })

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  assert.equal(document.querySelector('.dsw-session-drop-marker'), null, 'an old backend cannot advertise an insertion line')
  dispatchDrag(app.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 108 })
  await flush()
  assert.equal(app.calls.some(call => call.method === 'move'), false)
  assert.equal(app.nativeOrders.length, 0)
  assert.match(document.querySelector('[role="alert"]').textContent, /reload this plugin/i)

  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragend')
  dispatchDrag(app.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(app.dom, targetGroup.headerChild, 'dragover')
  dispatchDrag(app.dom, targetGroup.headerChild, 'drop')
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new' },
  ], 'header-based workspace moves retain their existing no-position behavior')
  assert.equal(app.nativeOrders.length, 0, 'default moves do not switch Native to manual ordering')
})

test('Native order is written only after migration, and a failed local order write is reported honestly', async (t) => {
  const rejected = setup({
    nativeOrderState: nativeOrderFixture(),
    moveResult: { ok: false, error: { message: 'backend rejected the move' } },
  })
  let rejectedDisposed = false
  t.after(() => { if (!rejectedDisposed) rejected.teardown() })
  let tree = createWorkspaceTree()
  let sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  let targetGroup = addWorkspaceGroup(tree, 'new', ['target-first'])
  setRect(targetGroup.sessions[0].row, { left: 40, top: 100, width: 280, height: 32 })
  dispatchDrag(rejected.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(rejected.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  dispatchDrag(rejected.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 108 })
  await flush()
  assert.equal(rejected.nativeOrders.length, 0, 'a backend rejection does not persist a destination order')
  assert.match(rejected.dom.window.document.querySelector('[role="alert"]').textContent, /backend rejected the move/)
  rejected.teardown()
  rejectedDisposed = true

  const localFailure = setup({ nativeOrderState: nativeOrderFixture(), nativeOrderActionError: 'storage blocked' })
  t.after(() => localFailure.teardown())
  tree = createWorkspaceTree()
  sourceGroup = addWorkspaceGroup(tree, 'old', ['session-one'])
  targetGroup = addWorkspaceGroup(tree, 'new', ['target-first'])
  setRect(targetGroup.sessions[0].row, { left: 40, top: 100, width: 280, height: 32 })
  dispatchDrag(localFailure.dom, sourceGroup.sessions[0].row, 'dragstart')
  await flush()
  dispatchDrag(localFailure.dom, targetGroup.sessions[0].child, 'dragover', undefined, { clientY: 108 })
  dispatchDrag(localFailure.dom, targetGroup.sessions[0].child, 'drop', undefined, { clientY: 108 })
  await flush()
  assert.equal(localFailure.calls.filter(call => call.method === 'move').length, 1)
  assert.match(localFailure.dom.window.document.querySelector('[role="alert"]').textContent,
    /session moved, but its sidebar position could not be saved: storage blocked/i)
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
  assert.match(document.querySelector('[role="alert"]').textContent, /session is loaded/i)
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
