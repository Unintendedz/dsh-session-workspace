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
  const source = document.createElement('div')
  source.dataset.rowKey = 'session:session-one'
  const workspace = document.createElement('div')
  workspace.dataset.rowKey = 'workspace:new'
  const workspaceChild = document.createElement('span')
  workspace.append(workspaceChild)
  document.body.append(source, workspace)
  let hostWorkspaceDragOver = false
  workspace.addEventListener('dragover', () => { hostWorkspaceDragOver = true })

  dispatchDrag(app.dom, source, 'dragstart')
  await flush()
  const dataTransfer = { dropEffect: 'none' }
  const over = dispatchDrag(app.dom, workspaceChild, 'dragover', dataTransfer)
  assert.equal(over.defaultPrevented, true)
  assert.equal(dataTransfer.dropEffect, 'move')
  assert.equal(hostWorkspaceDragOver, false, 'the workspace reorder handler must not receive a session drop')
  assert.equal(workspace.getAttribute('data-dsw-drop-target'), 'true')

  const drop = dispatchDrag(app.dom, workspaceChild, 'drop', dataTransfer)
  assert.equal(drop.defaultPrevented, true)
  dispatchDrag(app.dom, workspaceChild, 'drop', dataTransfer)
  await flush()
  assert.deepEqual(app.calls.filter(call => call.method === 'move').map(call => call.payload), [
    { sessionId: 'session-one', workspaceId: 'new' },
  ])
  assert.match(document.querySelector('[role="status"]').textContent, /Moved to “New”/)
})

test('dragging an active session displays the backend safety reason without accepting a drop', async (t) => {
  const app = setup({ sessionState: state({ active: true }) })
  t.after(() => app.teardown())
  const source = document.createElement('div')
  source.dataset.rowKey = 'session:session-one'
  const target = document.createElement('div')
  target.dataset.rowKey = 'workspace:new'
  document.body.append(source, target)

  dispatchDrag(app.dom, source, 'dragstart')
  await flush()
  assert.match(document.querySelector('[role="alert"]').textContent, /session is still active/i)
  const over = dispatchDrag(app.dom, target, 'dragover')
  assert.equal(over.defaultPrevented, false)
  assert.equal(app.calls.some(call => call.method === 'move'), false)
})

test('a backend rejection after a drag is shown as a visible move error', async (t) => {
  const app = setup({ moveResult: { ok: false, error: { code: 'session-active', message: 'session became active' } } })
  t.after(() => app.teardown())
  const source = document.createElement('div')
  source.dataset.rowKey = 'session:session-one'
  const target = document.createElement('div')
  target.dataset.rowKey = 'workspace:new'
  document.body.append(source, target)

  dispatchDrag(app.dom, source, 'dragstart')
  await flush()
  dispatchDrag(app.dom, target, 'dragover')
  dispatchDrag(app.dom, target, 'drop')
  await flush()
  assert.match(document.querySelector('[role="alert"]').textContent, /session became active/)
})

test('same-workspace reorder and workspace-row drag are left to the host', async (t) => {
  const app = setup()
  t.after(() => app.teardown())
  const session = document.createElement('div')
  session.dataset.rowKey = 'session:session-one'
  const sameWorkspace = document.createElement('div')
  sameWorkspace.dataset.rowKey = 'workspace:old'
  const otherSession = document.createElement('div')
  otherSession.dataset.rowKey = 'session:session-two'
  const workspaceSource = document.createElement('div')
  workspaceSource.dataset.rowKey = 'workspace:old'
  const workspaceTarget = document.createElement('div')
  workspaceTarget.dataset.rowKey = 'workspace:new'
  document.body.append(session, sameWorkspace, otherSession, workspaceSource, workspaceTarget)

  dispatchDrag(app.dom, session, 'dragstart')
  await flush()
  assert.equal(dispatchDrag(app.dom, sameWorkspace, 'dragover').defaultPrevented, false)
  assert.equal(dispatchDrag(app.dom, otherSession, 'drop').defaultPrevented, false)
  dispatchDrag(app.dom, session, 'dragend')

  const callsBeforeWorkspaceDrag = app.calls.length
  dispatchDrag(app.dom, workspaceSource, 'dragstart')
  assert.equal(app.calls.length, callsBeforeWorkspaceDrag)
  assert.equal(dispatchDrag(app.dom, workspaceTarget, 'dragover').defaultPrevented, false)
  assert.equal(app.calls.some(call => call.method === 'move'), false)
})

test('apply cleanup removes slot registration, styles, and global drag handlers', () => {
  const app = setup()
  const localDocument = app.dom.window.document
  const source = document.createElement('div')
  source.dataset.rowKey = 'session:session-one'
  document.body.append(source)
  const before = app.calls.length
  const cleaned = app.teardown()
  assert.deepEqual(cleaned, { registrationRemoved: true, localeRemoved: true })
  assert.equal(localDocument.getElementById('dsh-session-workspace-style'), null)
  dispatchDrag(app.dom, source, 'dragstart')
  assert.equal(app.calls.length, before)
})
