import React from 'react'

const NS = 'dsh-session-workspace'
const STYLE_ID = 'dsh-session-workspace-style'
const RPC_PATH = '/dsh-session-workspace'
const SESSION_MENU_SLOT = 'sidebar.workspaces.session.menu.item'
const MENU_ITEM_ID = `${NS}.move`
const CROSS_WORKSPACE_TREE_ATTRIBUTE = 'data-dsw-cross-workspace-drop-active'
const NATIVE_WORKSPACE_SLOT = 'sidebar.workspaces'
const NATIVE_VIEW_PERSIST = 'dsh.workspace.view.v5'
const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'
const SESSION_RELEASE_WAIT_MS = 2000
const SESSION_PROJECTION_SOURCE = 'workspaceOperation'

const zh = {
  'menu.move': '移动到其他工作区',
  'dialog.title': '移动会话',
  'dialog.help': '会话 ID 保持不变；之后的文件操作会以新工作区为根目录。原始 session 文件会保留一份备份。',
  'dialog.current': '当前工作区',
  'dialog.ungrouped': '未分组',
  'dialog.target': '目标工作区',
  'dialog.cancel': '取消',
  'dialog.move': '移动',
  'dialog.moving': '正在安全移动…',
  'dialog.moved': '已移动到“{title}”。',
  'drag.moved': '已移动到“{title}”。',
  'reason.session-active': '这个会话仍由 Host Agent 加载，但当前后端不支持安全移动已加载会话。',
  'reason.session-busy': '这个会话仍有正在运行或排队的工作。请等它空闲后再移动；移动操作不会停止工作。',
  'reason.unsupported': '当前 DSH 版本或持久化后端不支持安全迁移。',
  'reason.no-targets': '没有其他可用工作区。',
  'error.load': '无法读取工作区：{message}',
  'error.move': '移动失败：{message}',
  'error.already-moving': '这个会话已有一个移动操作正在进行。',
  'error.order-unavailable': '无法读取完整的原生侧栏顺序；这次没有移动会话。请等侧栏加载完成后重试。',
  'error.order-boundary': '原生侧栏固定了新会话和置顶分区，这个插入边界无法实现；会话没有移动。',
  'error.position-unsupported': '当前后端不支持会话行间定位；请重新加载本插件后重试，或拖到工作区标题/留白处移动。',
  'error.order-save': '会话已移动，但无法保存侧栏插入位置：{message}',
  'error.view-unavailable': '无法核实或释放当前会话视图；未发送移动请求。',
  'error.view-release': '当前会话仍被其他组件保留，未发送移动请求。',
  'error.view-changed': '等待期间当前会话视图已切换；未发送移动请求。',
  'error.projection-unavailable': '当前 Native 会话服务无法刷新移动后的标题投影；未发送移动请求。',
  'error.projection-refresh': '会话已移动，但标题加载失败：{message}',
  'error.view-release-restore': '无法准备当前会话视图：{message}；恢复原会话也失败：{restoreMessage}。未发送移动请求。',
  'error.move-restore': '移动失败：{moveMessage}；并且无法恢复原会话视图：{restoreMessage}',
  'error.view-restore': '会话已移动，但无法刷新并重新打开原会话：{message}',
}

const en = {
  'menu.move': 'Move to another workspace',
  'dialog.title': 'Move session',
  'dialog.help': 'The session ID stays the same. Future file operations use the new workspace, and the original session artifact is backed up.',
  'dialog.current': 'Current workspace',
  'dialog.ungrouped': 'Ungrouped',
  'dialog.target': 'Target workspace',
  'dialog.cancel': 'Cancel',
  'dialog.move': 'Move',
  'dialog.moving': 'Moving safely…',
  'dialog.moved': 'Moved to “{title}”.',
  'drag.moved': 'Moved to “{title}”.',
  'reason.session-active': 'This session still has a loaded Host Agent, and the current backend cannot safely move loaded sessions.',
  'reason.session-busy': 'This session has running or queued work. Wait until it is idle; moving will not stop that work.',
  'reason.unsupported': 'This DSH version or persistence backend cannot move sessions safely.',
  'reason.no-targets': 'No other workspace is available.',
  'error.load': 'Could not load workspaces: {message}',
  'error.move': 'Move failed: {message}',
  'error.already-moving': 'A move for this session is already in progress.',
  'error.order-unavailable': 'The complete native sidebar order is unavailable, so the session was not moved. Wait for the sidebar to finish loading and try again.',
  'error.order-boundary': 'The native sidebar keeps new and pinned sessions in fixed sections, so this insertion boundary cannot be honored. The session was not moved.',
  'error.position-unsupported': 'The current backend does not support insertion between session rows. Reload this plugin and try again, or drop on the workspace header or empty area to move the session.',
  'error.order-save': 'The session moved, but its sidebar position could not be saved: {message}',
  'error.view-unavailable': 'The current session view cannot be verified or released; no move was sent.',
  'error.view-release': 'Another component still retains this session, so it was not moved.',
  'error.view-changed': 'The current session changed while waiting; no move was sent.',
  'error.projection-unavailable': 'The Native session service cannot refresh the moved session title; no move was sent.',
  'error.projection-refresh': 'The session moved, but its title could not be loaded: {message}',
  'error.view-release-restore': 'Could not prepare the current session view: {message}; restoring the original session also failed: {restoreMessage}. No move was sent.',
  'error.move-restore': 'The move failed: {moveMessage}; the original session view could not be restored: {restoreMessage}',
  'error.view-restore': 'The session moved, but its view could not be refreshed and reopened: {message}',
}

export const inject = ['locale', 'connection', 'slots', 'sessions', 'workspaces', 'uiWorkspace']

export function workspaceDialogModel(state) {
  const choices = state.workspaces.filter(workspace => workspace.workspaceId !== state.currentWorkspaceId)
  const reason = state.busy === true
    ? 'session-busy'
    : state.active === true && state.warmMoveSupported !== true
      ? 'session-active'
    : !state.supported
      ? 'unsupported'
      : choices.length === 0 ? 'no-targets' : undefined
  return { canMove: reason === undefined, reason, choices }
}

export function sessionIdFromElement(element) {
  const row = element?.closest?.('[data-row-key^="session:"]') ?? element
  const key = row?.getAttribute?.('data-row-key') ?? row?.dataset?.rowKey
  if (typeof key !== 'string' || !key.startsWith('session:')) return undefined
  const sessionId = key.slice('session:'.length)
  return sessionId.trim() === '' ? undefined : sessionId
}

function resultError(result) {
  return result?.ok === false && typeof result.error?.message === 'string'
    ? result.error.message
    : 'unknown error'
}

function sessionIdFromLegacyFiber(element) {
  const key = Object.getOwnPropertyNames(element).find(name => name.startsWith('__reactFiber$'))
  let fiber = key === undefined ? undefined : element[key]
  for (let depth = 0; fiber !== undefined && fiber !== null && depth < 64; depth += 1) {
    const sessionId = fiber.memoizedProps?.node?.id
    if (typeof sessionId === 'string' && sessionId.trim() !== '') return sessionId
    fiber = fiber.return
  }
  return undefined
}

function element(name, className, text) {
  const node = document.createElement(name)
  if (className !== undefined) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function currentWorkspaceLabel(state, t) {
  return state.workspaces.find(workspace => workspace.workspaceId === state.currentWorkspaceId)?.title
    ?? state.currentPath
    ?? t('dialog.ungrouped')
}

function focusable(dialog) {
  return Array.from(dialog.querySelectorAll('button:not(:disabled), select:not(:disabled)'))
}

function showToast(message, { error = false, duration = 3000 } = {}) {
  const toast = element('div', 'dsw-toast', message)
  toast.setAttribute('role', error ? 'alert' : 'status')
  toast.dataset.error = String(error)
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), duration)
}

function localizedError(t, key, values) {
  const error = new Error(t(key, values))
  error.localUserMessage = true
  return error
}

function serviceFromContext(ctx, name) {
  try {
    const service = typeof ctx.get === 'function' ? ctx.get(name) : undefined
    return service ?? ctx[name]
  } catch {
    return ctx[name]
  }
}

function readMainViewState(ctx, sessionId, t) {
  const sessions = serviceFromContext(ctx, 'sessions')
  const listSource = sessions?.list
  const snapshot = listSource?.getSnapshot?.()
  const summary = snapshot?.byId?.[sessionId]
  const retentionSource = sessions?.retainInfo?.(sessionId)
  const retention = retentionSource?.getSnapshot?.()
  if (snapshot?.phase !== 'ready' || snapshot.byId === null || typeof snapshot.byId !== 'object'
    || summary === undefined
    || retention === undefined || retention.retainedBy === null || typeof retention.retainedBy !== 'object'
    || !Number.isSafeInteger(retention.referenceCount) || retention.referenceCount < 0) {
    throw localizedError(t, 'error.view-unavailable')
  }

  const retainedMainView = retention.retainedBy.mainView ?? 0
  if (!Number.isSafeInteger(retainedMainView)) {
    throw localizedError(t, 'error.view-unavailable')
  }

  const rows = Object.entries(snapshot.byId)
  const summariesHaveRetention = rows.every(([, candidate]) =>
    candidate?.retainedBy !== null && typeof candidate?.retainedBy === 'object')
  const currentIds = []
  for (const [id, candidate] of rows) {
    let mainView = candidate.retainedBy?.mainView ?? 0
    if (!summariesHaveRetention) {
      const candidateRetention = sessions.retainInfo?.(id)?.getSnapshot?.()
      if (candidateRetention?.retainedBy === null || typeof candidateRetention?.retainedBy !== 'object') {
        throw localizedError(t, 'error.view-unavailable')
      }
      mainView = candidateRetention.retainedBy.mainView ?? 0
    }
    if (!Number.isSafeInteger(mainView)) throw localizedError(t, 'error.view-unavailable')
    if (candidate.retainedBy !== undefined && candidate.retainedBy !== null
      && typeof candidate.retainedBy === 'object'
      && (candidate.retainedBy.mainView ?? 0) !== mainView) {
      throw localizedError(t, 'error.view-unavailable')
    }
    if (mainView > 0) currentIds.push(id)
  }
  const summaryHasRetention = summary.retainedBy !== null && typeof summary.retainedBy === 'object'
  const summaryMainView = summaryHasRetention ? summary.retainedBy.mainView ?? 0 : retainedMainView
  if (currentIds.length > 1 || ((retainedMainView > 0) !== (currentIds[0] === sessionId))) {
    throw localizedError(t, 'error.view-unavailable')
  }
  if (!Number.isSafeInteger(summaryMainView) || summaryMainView !== retainedMainView) {
    throw localizedError(t, 'error.view-unavailable')
  }

  return {
    sessions,
    listSource,
    retentionSource,
    retention,
    currentSessionId: currentIds[0],
  }
}

function requireMainViewRelease(ctx, sessionId, state, t) {
  if (state.sessionId !== sessionId) throw localizedError(t, 'error.view-unavailable')
  const before = readMainViewState(ctx, sessionId, t)
  if (typeof before.sessions.refresh !== 'function') {
    throw localizedError(t, 'error.view-unavailable')
  }
  if (before.currentSessionId !== sessionId) {
    if (typeof before.sessions.using !== 'function') {
      throw localizedError(t, 'error.projection-unavailable')
    }
    return { ...before, sessionId, wasCurrent: false, expectedCurrentSessionId: before.currentSessionId }
  }

  if (state.warmMoveSupported !== true) {
    throw localizedError(t, 'error.view-unavailable')
  }

  if (typeof before.listSource?.subscribe !== 'function'
    || typeof before.retentionSource?.subscribe !== 'function') {
    throw localizedError(t, 'error.view-unavailable')
  }

  const uiWorkspace = serviceFromContext(ctx, 'uiWorkspace')
  if (typeof uiWorkspace?.clearMain !== 'function'
    || typeof uiWorkspace?.openSession !== 'function') {
    throw localizedError(t, 'error.view-unavailable')
  }

  // DSH 0.2.0-rc.2 documents openSession but not clearMain. This version-limited
  // bridge uses that exact Native method and fails closed if a future version
  // removes it; it never reaches into React state or private storage.
  return { ...before, uiWorkspace, sessionId, wasCurrent: true }
}

function mainViewIsVacant(ctx, sessionId, t) {
  return readMainViewState(ctx, sessionId, t).currentSessionId === undefined
}

function restoreMainSessionIfVacant(ctx, release, t) {
  if (!release.wasCurrent) return undefined
  try {
    if (!mainViewIsVacant(ctx, release.sessionId, t)) return undefined
    release.uiWorkspace.openSession(release.sessionId)
    const restored = readMainViewState(ctx, release.sessionId, t)
    if (restored.currentSessionId !== release.sessionId) throw localizedError(t, 'error.view-unavailable')
    return undefined
  } catch (error) {
    return error
  }
}

function readReleaseWaitState(release, t) {
  const snapshot = release.listSource.getSnapshot()
  const retention = release.retentionSource.getSnapshot()
  if (snapshot?.phase !== 'ready' || snapshot.byId === null || typeof snapshot.byId !== 'object'
    || snapshot.byId[release.sessionId] === undefined
    || retention?.retainedBy === null || typeof retention?.retainedBy !== 'object'
    || !Number.isSafeInteger(retention.referenceCount) || retention.referenceCount < 0) {
    throw localizedError(t, 'error.view-unavailable')
  }

  const targetMainView = retention.retainedBy.mainView ?? 0
  if (!Number.isSafeInteger(targetMainView) || targetMainView < 0) {
    throw localizedError(t, 'error.view-unavailable')
  }
  const summaryTargetMainView = snapshot.byId[release.sessionId].retainedBy?.mainView
  if (summaryTargetMainView !== undefined
    && (!Number.isSafeInteger(summaryTargetMainView) || summaryTargetMainView < 0)) {
    throw localizedError(t, 'error.view-unavailable')
  }

  const currentIds = []
  for (const [id, candidate] of Object.entries(snapshot.byId)) {
    let mainView = candidate?.retainedBy?.mainView
    if (mainView === undefined) {
      const otherRetention = release.sessions.retainInfo?.(id)?.getSnapshot?.()
      if (otherRetention?.retainedBy === null || typeof otherRetention?.retainedBy !== 'object') {
        throw localizedError(t, 'error.view-unavailable')
      }
      mainView = otherRetention.retainedBy.mainView ?? 0
    }
    if (!Number.isSafeInteger(mainView) || mainView < 0) {
      throw localizedError(t, 'error.view-unavailable')
    }
    if (mainView > 0) currentIds.push(id)
  }

  return { retention, targetMainView, summaryTargetMainView, currentIds }
}

function userNavigatedError(t) {
  const error = localizedError(t, 'error.view-changed')
  error.userNavigated = true
  return error
}

function waitForSessionReferencesToDrain(release, t, expectedCurrentSessionId) {
  return new Promise((resolve, reject) => {
    let settled = false
    let installing = true
    let timer
    const disposers = []
    const cleanup = () => {
      clearTimeout(timer)
      for (const dispose of disposers.splice(0).reverse()) {
        try { dispose() } catch {}
      }
    }
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      cleanup()
      callback(value)
    }
    const check = () => {
      if (settled) return
      try {
        const observed = readReleaseWaitState(release, t)
        const expectedCurrentIds = expectedCurrentSessionId === undefined ? [] : [expectedCurrentSessionId]
        const currentUnchanged = release.wasCurrent
          ? observed.currentIds.every(id => id === release.sessionId)
          : observed.currentIds.length === expectedCurrentIds.length
            && expectedCurrentIds.every(id => observed.currentIds.includes(id))
        if (!currentUnchanged) {
          finish(reject, userNavigatedError(t))
          return
        }
        const currentReleased = release.wasCurrent
          ? observed.currentIds.length === 0 && observed.targetMainView === 0
          : observed.currentIds.length === expectedCurrentIds.length
            && observed.currentIds.every(id => expectedCurrentIds.includes(id))
        const summaryMatches = observed.summaryTargetMainView === undefined
          || observed.summaryTargetMainView === observed.targetMainView
        if (currentReleased && observed.retention.referenceCount === 0 && summaryMatches) {
          finish(resolve)
        }
      } catch (error) {
        finish(reject, error)
      }
    }
    const onChange = () => {
      // ObservableSnapshot implementations need not suppress a synchronous
      // notification during subscribe; defer until both unsubscribe handles exist.
      if (installing) return
      check()
    }

    try {
      if (typeof release.listSource?.subscribe !== 'function'
        || typeof release.retentionSource?.subscribe !== 'function') {
        throw localizedError(t, 'error.view-unavailable')
      }
      disposers.push(release.listSource.subscribe(onChange))
      disposers.push(release.retentionSource.subscribe(onChange))
      timer = setTimeout(() => finish(reject, localizedError(t, 'error.view-release')), SESSION_RELEASE_WAIT_MS)
      installing = false
      // The list subscription covers selection changes globally, while this
      // per-ID source observes every owner releasing the target generation.
      // Re-read after subscribing so a release between initial inspection and subscribe
      // cannot be missed.
      check()
    } catch (error) {
      installing = false
      finish(reject, error)
    }
  })
}

async function hydrateMovedSessionProjection(sessions, sessionId) {
  await sessions.using(sessionId, { source: SESSION_PROJECTION_SOURCE }, async reference => {
    await reference.ready
    const snapshot = reference.binding?.session?.getSnapshot?.()
    if (snapshot?.openState === 'open') return
    const openError = snapshot?.openError
    const summarize = value => typeof value === 'string'
      ? value.replace(/\s+/g, ' ').slice(0, 180)
      : undefined
    const code = summarize(openError?.code)
    const message = summarize(openError?.message)
      ?? (typeof openError === 'string' ? summarize(openError) : undefined)
    const details = [
      `openState=${summarize(snapshot?.openState) ?? 'unknown'}`,
      code === undefined ? undefined : `code=${code}`,
      message === undefined ? undefined : `message=${message}`,
    ].filter(Boolean)
    throw new Error(details.join('; '))
  })
}

async function moveSessionSafely(ctx, t, state, workspaceId, position, afterCommit) {
  const model = workspaceDialogModel(state)
  if (!model.canMove) throw localizedError(t, `reason.${model.reason ?? 'unsupported'}`)

  const release = requireMainViewRelease(ctx, state.sessionId, state, t)
  if (release.wasCurrent) {
    try {
      release.uiWorkspace.clearMain()
      await waitForSessionReferencesToDrain(release, t, undefined)
      const afterRelease = readMainViewState(ctx, state.sessionId, t)
      if (afterRelease.currentSessionId !== undefined) {
        if (afterRelease.currentSessionId !== state.sessionId) throw userNavigatedError(t)
        throw localizedError(t, 'error.view-release')
      }
      if (afterRelease.retention.referenceCount !== 0) {
        throw localizedError(t, 'error.view-release')
      }
    } catch (error) {
      if (error?.userNavigated === true) throw error
      const restoreError = restoreMainSessionIfVacant(ctx, release, t)
      if (restoreError !== undefined) {
        throw localizedError(t, 'error.view-release-restore', {
          message: error instanceof Error ? error.message : String(error),
          restoreMessage: restoreError instanceof Error ? restoreError.message : String(restoreError),
        })
      }
      throw error
    }
  } else if (release.retention.referenceCount !== 0) {
    await waitForSessionReferencesToDrain(release, t, release.expectedCurrentSessionId)
  }

  if (!release.wasCurrent) {
    const beforeMove = readMainViewState(ctx, state.sessionId, t)
    if (beforeMove.currentSessionId !== release.expectedCurrentSessionId) throw userNavigatedError(t)
    if (beforeMove.retention.referenceCount !== 0) throw localizedError(t, 'error.view-release')
  }

  let result
  try {
    result = await ctx.connection.rpc.call(RPC_PATH, 'move', {
      sessionId: state.sessionId,
      workspaceId,
      ...(position === undefined ? {} : { position }),
    })
    if (!result?.ok) throw new Error(resultError(result))
  } catch (error) {
    const restoreError = restoreMainSessionIfVacant(ctx, release, t)
    if (restoreError !== undefined) {
      throw localizedError(t, 'error.move-restore', {
        moveMessage: error instanceof Error ? error.message : String(error),
        restoreMessage: restoreError instanceof Error ? restoreError.message : String(restoreError),
      })
    }
    throw error
  }

  let postMoveError
  let postMoveErrorKind
  try {
    await afterCommit?.()
  } catch (error) {
    postMoveError = error
    postMoveErrorKind = 'order'
  }
  if (release.wasCurrent) {
    try {
      await release.sessions.refresh()
    } catch (error) {
      postMoveError ??= error
      postMoveErrorKind ??= 'refresh'
    }
  } else {
    // The first list refresh learns the moved ID in its destination before
    // using() opens a fresh generation. The final refresh publishes its title
    // projection after that temporary follow has completed.
    try {
      await release.sessions.refresh()
    } catch (error) {
      postMoveError ??= error
      postMoveErrorKind ??= 'refresh'
    }
    try {
      // This public read opens the moved session's projection in its own
      // temporary generation. It does not select the session in the UI.
      await hydrateMovedSessionProjection(release.sessions, state.sessionId)
    } catch (error) {
      postMoveError ??= error
      postMoveErrorKind ??= 'projection'
    }
    try {
      await release.sessions.refresh()
    } catch (error) {
      postMoveError ??= error
      postMoveErrorKind ??= 'refresh'
    }
  }

  const restoreError = restoreMainSessionIfVacant(ctx, release, t)
  postMoveError ??= restoreError
  postMoveErrorKind ??= restoreError === undefined ? undefined : 'restore'
  if (postMoveError !== undefined) {
    if (postMoveError.localUserMessage === true) throw postMoveError
    const message = postMoveError instanceof Error ? postMoveError.message : String(postMoveError)
    const errorKey = postMoveErrorKind === 'projection'
      ? 'error.projection-refresh'
      : afterCommit === undefined ? 'error.view-restore' : 'error.order-save'
    const error = localizedError(t, errorKey, { message })
    error.moved = true
    throw error
  }
  return result.value
}

function openDialog(ctx, anchor, sessionId, state, t) {
  const model = workspaceDialogModel(state)
  const overlay = element('div', 'dsw-overlay')
  const dialog = element('section', 'dsw-dialog')
  const titleId = `dsw-title-${crypto.randomUUID()}`
  const helpId = `dsw-help-${crypto.randomUUID()}`
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-labelledby', titleId)
  dialog.setAttribute('aria-describedby', helpId)

  const title = element('h2', 'dsw-title', t('dialog.title'))
  title.id = titleId
  const help = element('p', 'dsw-help', t('dialog.help'))
  help.id = helpId
  const currentLabel = element('span', 'dsw-label', t('dialog.current'))
  const current = element('div', 'dsw-current', currentWorkspaceLabel(state, t))
  const targetLabel = element('label', 'dsw-label', t('dialog.target'))
  const select = element('select', 'dsw-select')
  const selectId = `dsw-select-${crypto.randomUUID()}`
  select.id = selectId
  targetLabel.htmlFor = selectId
  for (const workspace of model.choices) {
    const option = element('option', undefined, workspace.title)
    option.value = workspace.workspaceId
    option.title = workspace.path
    select.appendChild(option)
  }
  select.disabled = !model.canMove

  const status = element('p', 'dsw-status')
  status.setAttribute('aria-live', 'polite')
  if (model.reason !== undefined) {
    status.textContent = t(`reason.${model.reason}`)
    status.dataset.error = 'true'
  }
  const actions = element('div', 'dsw-actions')
  const cancel = element('button', 'dsw-button', t('dialog.cancel'))
  cancel.type = 'button'
  const confirm = element('button', 'dsw-button dsw-primary', t('dialog.move'))
  confirm.type = 'button'
  confirm.disabled = !model.canMove
  actions.append(cancel, confirm)
  dialog.append(title, help, currentLabel, current, targetLabel, select, status, actions)
  overlay.appendChild(dialog)
  document.body.appendChild(overlay)

  let busy = false
  const close = () => {
    if (busy) return
    document.removeEventListener('keydown', onKeyDown, true)
    overlay.remove()
    if (anchor.isConnected) anchor.focus()
  }
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusable(dialog)
    if (items.length === 0) return
    const first = items[0]
    const last = items.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  document.addEventListener('keydown', onKeyDown, true)
  overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close() })
  cancel.addEventListener('click', close)
  confirm.addEventListener('click', async () => {
    if (busy || !model.canMove) return
    if (movingSessions.has(sessionId)) {
      status.dataset.error = 'true'
      status.textContent = t('error.already-moving')
      return
    }
    busy = true
    movingSessions.add(sessionId)
    select.disabled = true
    cancel.disabled = true
    confirm.disabled = true
    status.dataset.error = 'false'
    status.textContent = t('dialog.moving')
    const workspace = model.choices.find(choice => choice.workspaceId === select.value)
    try {
      await moveSessionSafely(ctx, t, state, select.value)
      status.textContent = t('dialog.moved', { title: workspace?.title ?? select.value })
      busy = false
      setTimeout(close, 700)
    } catch (error) {
      busy = false
      select.disabled = false
      cancel.disabled = false
      confirm.disabled = false
      status.dataset.error = 'true'
      status.textContent = error?.localUserMessage === true
        ? error.message
        : t('error.move', { message: error instanceof Error ? error.message : String(error) })
      select.focus()
    } finally {
      movingSessions.delete(sessionId)
    }
  })
  ;(model.canMove ? select : cancel).focus()
}

async function loadAndOpenDialog(ctx, anchor, sessionId, t) {
  try {
    const result = await ctx.connection.rpc.call(RPC_PATH, 'state', { sessionId })
    if (!result?.ok) throw new Error(resultError(result))
    openDialog(ctx, anchor, sessionId, result.value, t)
  } catch (error) {
    showToast(t('error.load', { message: error instanceof Error ? error.message : String(error) }), { error: true })
  }
}

function MoveSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, moveSession, t }) {
  const [, setMenuOpen] = useMenuOpenState()
  return React.createElement('button', {
    type: 'button',
    role: 'menuitem',
    className: 'dsw-menu-item',
    title: displayTitle,
    onClick: (event) => {
      event.preventDefault()
      event.stopPropagation()
      setMenuOpen(false)
      void moveSession(sessionId, event.currentTarget)
    },
  }, React.createElement('span', { className: 'dsw-menu-icon', 'aria-hidden': 'true' }, '↗'),
  React.createElement('span', undefined, t('menu.move')))
}

function registerSessionMenu(ctx, t) {
  return ctx.slots.inject(SESSION_MENU_SLOT, () => ctx.slots.register({
    name: SESSION_MENU_SLOT,
    id: MENU_ITEM_ID,
    order: 500,
    locale: NS,
    inject: () => ({
      moveSession: (sessionId, anchor) => loadAndOpenDialog(ctx, anchor, sessionId, t),
    }),
  }, MoveSessionMenuItem))
}

function nearestLegacyMenu(anchor) {
  const anchorRect = anchor.getBoundingClientRect()
  return Array.from(document.querySelectorAll('[role="menu"]'))
    .filter((menu) => {
      const rect = menu.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && menu.querySelector('[role="menuitem"]') !== null
    })
    .sort((left, right) => {
      const a = left.getBoundingClientRect()
      const b = right.getBoundingClientRect()
      const aDistance = Math.abs(a.left - anchorRect.left) + Math.abs(a.top - anchorRect.bottom)
      const bDistance = Math.abs(b.left - anchorRect.left) + Math.abs(b.top - anchorRect.bottom)
      return aDistance - bDistance
    })[0]
}

function legacyMoveIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  for (const [name, value] of Object.entries({
    width: '16', height: '16', viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true',
  })) svg.setAttribute(name, value)
  for (const attributes of [
    { d: 'M2.5 4.5h4l1.2 1.4h5.8v6.6h-11z', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round' },
    { d: 'M5 9h5m-1.7-1.7L10 9l-1.7 1.7', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
  ]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    for (const [name, value] of Object.entries(attributes)) path.setAttribute(name, value)
    svg.appendChild(path)
  }
  return svg
}

function mountLegacyMenuItem(ctx, anchor, sessionId, t) {
  const menu = nearestLegacyMenu(anchor)
  if (menu === undefined) return false
  if (menu.querySelector('[data-dsh-session-workspace]') !== null) return true
  const template = menu.querySelector('[role="menuitem"]')
  if (template === null) return false
  const item = template.cloneNode(false)
  item.dataset.dshSessionWorkspace = sessionId
  const icon = element('span')
  icon.className = template.firstElementChild?.className ?? ''
  icon.appendChild(legacyMoveIcon())
  const label = element('span', template.lastElementChild?.className ?? '', t('menu.move'))
  item.append(icon, label)
  item.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    anchor.click()
    void loadAndOpenDialog(ctx, anchor, sessionId, t)
  })
  menu.insertBefore(item, template.nextSibling)
  window.dispatchEvent(new Event('resize'))
  return true
}

function installLegacyMenuFallback(ctx, t) {
  const timers = new Set()
  const schedule = (callback, delay) => {
    let timer
    timer = setTimeout(() => {
      timers.delete(timer)
      callback()
    }, delay)
    timers.add(timer)
    return timer
  }
  const onClick = (event) => {
    const target = event.target
    if (typeof target?.closest !== 'function') return
    const button = target.closest('button')
    if (button === null || button.closest('[role="treeitem"]') === null) return
    const sessionId = sessionIdFromLegacyFiber(button)
    if (sessionId === undefined) return
    let attempt = 0
    const mount = () => {
      if (mountLegacyMenuItem(ctx, button, sessionId, t)) return
      attempt += 1
      if (attempt < 5) schedule(mount, 20)
    }
    schedule(mount, 0)
  }
  document.addEventListener('click', onClick, true)
  return () => {
    document.removeEventListener('click', onClick, true)
    for (const timer of timers) clearTimeout(timer)
    timers.clear()
  }
}

function hasModernSessionMenuSlot(ctx) {
  if (typeof ctx.slots.snapshot !== 'function') return true
  return ctx.slots.snapshot(SESSION_MENU_SLOT).length > 0
}

function workspaceIdFromElement(element) {
  const row = element?.closest?.('[data-row-key^="workspace:"]')
  const key = row?.getAttribute?.('data-row-key') ?? row?.dataset?.rowKey
  if (typeof key !== 'string' || !key.startsWith('workspace:')) return undefined
  const workspaceId = key.slice('workspace:'.length)
  return workspaceId.trim() === '' ? undefined : workspaceId
}

function rowFromSingleChildBranch(branch, tree) {
  for (let node = branch; node !== null && node !== undefined && node !== tree;) {
    const key = node.getAttribute?.('data-row-key') ?? node.dataset?.rowKey
    if (typeof key === 'string' && (key.startsWith('workspace:') || key.startsWith('session:'))) return node
    const role = node.getAttribute?.('role')
    if (role === 'tree' || role === 'group' || role === 'treeitem') return undefined
    if (node.children?.length !== 1) return undefined
    node = node.children[0]
  }
  return undefined
}

function workspaceDropTargetFromElement(element, sourceTree) {
  const origin = element?.nodeType === 1 ? element : element?.parentElement
  const targetTree = origin?.closest?.('[role="tree"]')
  if (sourceTree === undefined || targetTree !== sourceTree) return undefined

  let target
  for (let container = origin; container !== null && container !== undefined && container !== sourceTree; container = container.parentElement) {
    if (container.getAttribute?.('role') === 'group') break
    const workspaceRows = Array.from(container.children ?? [])
      .map(child => rowFromSingleChildBranch(child, sourceTree))
      .filter(row => {
        const key = row?.getAttribute?.('data-row-key') ?? row?.dataset?.rowKey
        return typeof key === 'string' && key.startsWith('workspace:')
      })
    if (workspaceRows.length !== 1) continue
    const workspaceId = workspaceIdFromElement(workspaceRows[0])
    if (workspaceId !== undefined) target = { workspaceId, container }
  }
  return target
}

function sessionDropPosition(event, targetContainer, sourceTree) {
  const origin = event.target?.nodeType === 1 ? event.target : event.target?.parentElement
  const row = origin?.closest?.('[data-row-key^="session:"]')
  if (row === null || row === undefined || row.closest?.('[role="tree"]') !== sourceTree) return undefined
  const rowTarget = workspaceDropTargetFromElement(row, sourceTree)
  if (rowTarget?.container !== targetContainer) return undefined
  const anchorSessionId = sessionIdFromElement(row)
  if (anchorSessionId === undefined) return undefined
  const rect = row.getBoundingClientRect()
  if (!Number.isFinite(event.clientY) || !Number.isFinite(rect.top) || !Number.isFinite(rect.height) || rect.height <= 0) return undefined
  const side = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  return { anchorSessionId, side, rect }
}

function orderByRecency(sessionIds, summaries) {
  return sessionIds.flatMap(id => {
    const summary = summaries[id]
    return summary === undefined ? [] : [{ id, rank: summary.updatedAt }]
  }).sort((a, b) => {
    if (a.rank !== b.rank) return b.rank - a.rank
    return a.id < b.id ? -1 : 1
  }).map(member => member.id)
}

function reconcileManualOrder(memberIds, savedOrder, summaries, pinnedSessionIds, archivedSessionIds) {
  const members = new Map(memberIds.map(id => [id, id]))
  const included = new Set()
  const ordered = []
  for (const key of savedOrder ?? []) {
    const id = members.get(key)
    if (id === undefined || included.has(key)) continue
    ordered.push(id)
    included.add(key)
  }

  const archived = new Set(archivedSessionIds)
  const pins = []
  for (const id of pinnedSessionIds) {
    if (!members.has(id) || included.has(id) || archived.has(id) || summaries[id] === undefined) continue
    pins.push(id)
    included.add(id)
  }

  const ordinary = []
  const archives = []
  for (const id of orderByRecency(memberIds.filter(memberId => !included.has(memberId)), summaries)) {
    if (archived.has(id)) archives.push(id)
    else ordinary.push(id)
  }

  const result = [...pins, ...ordered, ...ordinary, ...archives]
  const pending = new Set(ordinary)
  const placeFork = id => {
    if (!pending.delete(id)) return
    const parentId = summaries[id]?.parentId
    if (parentId === undefined || parentId === id || !result.includes(parentId)) return
    placeFork(parentId)
    result.splice(result.indexOf(id), 1)
    result.splice(result.indexOf(parentId), 0, id)
  }
  for (const id of [...ordinary].reverse()) placeFork(id)
  return result
}

function nativeMainSessionId(summaries) {
  return Object.values(summaries).find(summary => (summary.retainedBy?.mainView ?? 0) > 0)?.id
}

function completeNativeSessionOrders(workspaceSnapshot, sessionSnapshot, viewSnapshot) {
  if (workspaceSnapshot.phase !== 'ready' || workspaceSnapshot.state === 'loading'
    || sessionSnapshot.phase !== 'ready') return undefined
  if (!Array.isArray(workspaceSnapshot.items) || !Array.isArray(sessionSnapshot.ids)
    || !Array.isArray(workspaceSnapshot.pinnedSessionIds) || !Array.isArray(workspaceSnapshot.archivedSessionIds)
    || sessionSnapshot.byId === null || typeof sessionSnapshot.byId !== 'object'
    || workspaceSnapshot.items.some(workspace => typeof workspace.workspaceId !== 'string' || !Array.isArray(workspace.sessionIds))) return undefined
  if (viewSnapshot.orderBy !== 'updated' && viewSnapshot.orderBy !== 'manual') return undefined

  const summaries = sessionSnapshot.byId
  const workspaces = workspaceSnapshot.items
  const pinnedSessionIds = Array.isArray(workspaceSnapshot.pinnedSessionIds) ? workspaceSnapshot.pinnedSessionIds : []
  const archivedSessionIds = Array.isArray(workspaceSnapshot.archivedSessionIds) ? workspaceSnapshot.archivedSessionIds : []
  const accounted = new Set(workspaces.flatMap(workspace => Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []))
  const current = nativeMainSessionId(summaries)
  const currentBlank = current !== undefined && summaries[current]?.blank === true ? current : undefined
  const members = Object.fromEntries([
    ...workspaces.map(workspace => [workspace.workspaceId, [...workspace.sessionIds]]),
    ['', sessionSnapshot.ids.filter(id => summaries[id] !== undefined && !accounted.has(id))],
    [FLAT_SESSION_ORDER_KEY, sessionSnapshot.ids.filter(id => {
      const summary = summaries[id]
      return summary !== undefined && summary.origin !== 'subagent' && (!summary.blank || id === current)
    })],
  ])
  const savedOrders = viewSnapshot.sessionOrderByAccount ?? {}
  const orders = Object.fromEntries(Object.entries(members).map(([accountKey, memberIds]) => {
    const ordered = viewSnapshot.orderBy === 'updated'
      ? orderByRecency(memberIds, summaries)
      : reconcileManualOrder(memberIds, savedOrders[accountKey], summaries, pinnedSessionIds, archivedSessionIds)
    if (currentBlank !== undefined && memberIds.includes(currentBlank)) {
      ordered.splice(0, ordered.length, currentBlank, ...ordered.filter(id => id !== currentBlank))
    }
    // Native rendering omits members while their summaries load. Keep their account slots at the tail,
    // except manual entries already saved above, whose relative positions are part of the user's order.
    for (const id of memberIds) if (summaries[id] === undefined && !ordered.includes(id)) ordered.push(id)
    return [accountKey, ordered]
  }))
  return { members, orders, summaries, current, currentBlank, pinnedSessionIds, archivedSessionIds, viewSnapshot }
}

function nativeSessionOrderSeed(ctx, current) {
  try {
    const slots = ctx.get('slots')
    const entry = slots.entriesOfSlot(NATIVE_WORKSPACE_SLOT)
      .find(candidate => candidate.store?.spec?.persist === NATIVE_VIEW_PERSIST)
    const view = entry?.store?.create?.()
    const workspaces = ctx.get('workspaces')
    const sessions = ctx.get('sessions')
    if (view?.getSnapshot === undefined || typeof view.actions?.setSessionOrder !== 'function'
      || workspaces?.list?.getSnapshot === undefined || sessions?.list?.getSnapshot === undefined) return undefined

    const viewSnapshot = view.getSnapshot()
    const workspaceSnapshot = workspaces.list.getSnapshot()
    const sessionSnapshot = sessions.list.getSnapshot()
    const cached = current.nativeOrderSeed
    if (cached?.view === view && cached.viewSnapshot === viewSnapshot
      && cached.workspaceSnapshot === workspaceSnapshot && cached.sessionSnapshot === sessionSnapshot) return cached
    const complete = completeNativeSessionOrders(workspaceSnapshot, sessionSnapshot, viewSnapshot)
    if (complete === undefined) return undefined
    const seed = { view, viewSnapshot, workspaceSnapshot, sessionSnapshot, ...complete }
    current.nativeOrderSeed = seed
    return seed
  } catch {
    return undefined
  }
}

function nativeVisibleSessions(accountOrder, seed) {
  const archived = new Set(seed.archivedSessionIds)
  const pinned = new Set(seed.pinnedSessionIds)
  const filter = seed.viewSnapshot.archivedFilter ?? 'default'
  const visible = accountOrder.filter(id => {
    const summary = seed.summaries[id]
    if (summary === undefined || summary.origin === 'subagent' || (summary.blank && id !== seed.current)) return false
    if (filter === 'default') return !archived.has(id)
    if (filter === 'only') return archived.has(id)
    return true
  })
  const blanks = []
  const pins = []
  const ordinary = []
  for (const id of visible) {
    if (seed.summaries[id].blank) blanks.push(id)
    else if (!archived.has(id) && pinned.has(id)) pins.push(id)
    else ordinary.push(id)
  }
  return { blanks, pins, ordinary, visible: [...blanks, ...pins, ...ordinary] }
}

function insertRelative(order, sessionId, anchorSessionId, side) {
  const next = order.filter(id => id !== sessionId)
  const index = next.indexOf(anchorSessionId)
  if (index === -1) return undefined
  next.splice(index + (side === 'after' ? 1 : 0), 0, sessionId)
  return next
}

function insertionForPartitionBoundary(order, sessionId, seed, parts, boundary, sourcePinned, pointerPosition) {
  const pinStart = parts.blanks.length
  const pinEnd = pinStart + parts.pins.length
  const targetId = pointerPosition.anchorSessionId
  const targetSummary = seed.summaries[targetId]
  const targetArchived = seed.archivedSessionIds.includes(targetId)
  const targetPinned = !targetArchived && seed.pinnedSessionIds.includes(targetId)
  const targetBlank = targetSummary.blank === true

  if (sourcePinned && targetPinned || !sourcePinned && !targetPinned && !targetBlank) {
    return insertRelative(order, sessionId, targetId, pointerPosition.side)
  }

  let anchorSessionId
  let side
  if (sourcePinned && boundary === pinStart) {
    if (parts.pins.length > 0) {
      anchorSessionId = parts.pins[0]
      side = 'before'
    } else if (parts.blanks.length > 0) {
      anchorSessionId = parts.blanks.at(-1)
      side = 'after'
    } else if (parts.ordinary.length > 0) {
      anchorSessionId = parts.ordinary[0]
      side = 'before'
    }
  } else if (sourcePinned && boundary === pinEnd) {
    if (parts.pins.length > 0) {
      anchorSessionId = parts.pins.at(-1)
      side = 'after'
    } else if (parts.ordinary.length > 0) {
      anchorSessionId = parts.ordinary[0]
      side = 'before'
    } else if (parts.blanks.length > 0) {
      anchorSessionId = parts.blanks.at(-1)
      side = 'after'
    }
  } else if (!sourcePinned && boundary === pinEnd) {
    if (targetBlank && parts.pins.length === 0) {
      anchorSessionId = targetId
      side = 'after'
    } else if (parts.ordinary.length > 0) {
      anchorSessionId = parts.ordinary[0]
      side = 'before'
    } else if (parts.pins.length > 0) {
      anchorSessionId = parts.pins.at(-1)
      side = 'after'
    } else if (parts.blanks.length > 0) {
      anchorSessionId = parts.blanks.at(-1)
      side = 'after'
    }
  }
  return anchorSessionId === undefined ? undefined : insertRelative(order, sessionId, anchorSessionId, side)
}

function nativeSessionOrderPlan(ctx, current, targetWorkspaceId, pointerPosition) {
  const seed = nativeSessionOrderSeed(ctx, current)
  if (seed === undefined) return { error: 'unavailable' }
  const sourceKey = current.sourceWorkspaceId ?? ''
  const sourceMembers = seed.members[sourceKey]
  const targetMembers = seed.members[targetWorkspaceId]
  const sourceSummary = seed.summaries[current.sessionId]
  const targetSummary = seed.summaries[pointerPosition.anchorSessionId]
  const targetOrder = seed.orders[targetWorkspaceId]
  if (!Array.isArray(sourceMembers) || !sourceMembers.includes(current.sessionId)
    || !Array.isArray(targetMembers) || !targetMembers.includes(pointerPosition.anchorSessionId)
    || !Array.isArray(targetOrder) || !Array.isArray(seed.orders[sourceKey])
    || sourceSummary === undefined || targetSummary === undefined
    || !targetOrder.includes(pointerPosition.anchorSessionId)) return { error: 'unavailable' }
  if (sourceSummary.blank === true || sourceSummary.origin === 'subagent'
    || seed.archivedSessionIds.includes(current.sessionId)) return { error: 'boundary' }

  const parts = nativeVisibleSessions(targetOrder, seed)
  const targetIndex = parts.visible.indexOf(pointerPosition.anchorSessionId)
  if (targetIndex === -1) return { error: 'unavailable' }
  const boundary = targetIndex + (pointerPosition.side === 'after' ? 1 : 0)
  const pinStart = parts.blanks.length
  const pinEnd = pinStart + parts.pins.length
  const sourcePinned = seed.pinnedSessionIds.includes(current.sessionId)
    && !seed.archivedSessionIds.includes(current.sessionId)
  const boundaryIsRepresentable = sourcePinned
    ? boundary >= pinStart && boundary <= pinEnd
    : boundary >= pinEnd && boundary <= parts.visible.length
  if (!boundaryIsRepresentable) return { error: 'boundary' }

  const nextOrder = insertionForPartitionBoundary(targetOrder, current.sessionId, seed, parts, boundary, sourcePinned, pointerPosition)
  if (nextOrder === undefined) return { error: 'unavailable' }
  const initialOrders = Object.fromEntries(Object.entries(seed.orders).map(([accountKey, order]) => [
    accountKey,
    accountKey === sourceKey ? order.filter(id => id !== current.sessionId)
      : accountKey === targetWorkspaceId ? [...nextOrder]
        : [...order],
  ]))
  return {
    view: seed.view,
    targetWorkspaceId,
    pointerPosition,
    nextOrder,
    initialOrders,
  }
}

const movingSessions = new Set()

function installSessionDragAndDrop(ctx, t) {
  let drag
  let highlighted
  let sessionMarker

  const clearHighlight = () => {
    highlighted?.removeAttribute('data-dsw-drop-target')
    highlighted = undefined
  }
  const setNativeMarkerHidden = (current, hidden) => {
    if (current?.sourceTree?.isConnected !== true) return
    if (hidden) current.sourceTree.setAttribute(CROSS_WORKSPACE_TREE_ATTRIBUTE, 'true')
    else current.sourceTree.removeAttribute(CROSS_WORKSPACE_TREE_ATTRIBUTE)
  }
  const clearSessionMarker = () => {
    sessionMarker?.remove()
    sessionMarker = undefined
  }
  const showSessionMarker = (position) => {
    if (sessionMarker === undefined) {
      sessionMarker = element('div', 'dsw-session-drop-marker')
      sessionMarker.setAttribute('aria-hidden', 'true')
      document.body.appendChild(sessionMarker)
    }
    sessionMarker.dataset.side = position.side
    sessionMarker.style.left = `${position.rect.left}px`
    sessionMarker.style.top = `${position.side === 'before' ? position.rect.top - 7 : position.rect.bottom - 5}px`
    sessionMarker.style.width = `${position.rect.width}px`
  }
  const onDragStart = (event) => {
    const sessionId = sessionIdFromElement(event.target)
    if (sessionId === undefined) return
    clearHighlight()
    clearSessionMarker()
    setNativeMarkerHidden(drag, false)
    const sourceRow = event.target?.closest?.('[data-row-key^="session:"]') ?? event.target
    const sourceTree = sourceRow?.closest?.('[role="tree"]')
    const sourceWorkspaceId = workspaceDropTargetFromElement(sourceRow, sourceTree)?.workspaceId
    const current = { sessionId, sourceTree, sourceWorkspaceId, state: undefined, handled: false }
    drag = current
    current.statePromise = Promise.resolve().then(() => ctx.connection.rpc.call(RPC_PATH, 'state', { sessionId }))
      .then((result) => {
        if (!result?.ok) throw new Error(resultError(result))
        current.state = result.value
        const model = workspaceDialogModel(current.state)
        if (drag === current && !current.handled && model.reason !== undefined) {
          current.reasonShown = true
          showToast(t(`reason.${model.reason}`), { error: true })
        }
        return current.state
      })
      .catch((error) => {
        current.failureMessage = error instanceof Error ? error.message : String(error)
        if (drag === current && !current.handled) {
          current.failureShown = true
          showToast(t('error.load', { message: current.failureMessage }), { error: true })
        }
        return undefined
      })
  }
  const onDragOver = (event) => {
    const current = drag
    if (current === undefined) return
    const dropTarget = workspaceDropTargetFromElement(event.target, current.sourceTree)
    if (dropTarget === undefined) {
      clearHighlight()
      clearSessionMarker()
      setNativeMarkerHidden(current, false)
      return
    }
    const { workspaceId } = dropTarget
    const dataTransfer = event.dataTransfer
    if (current.state === undefined) {
      clearSessionMarker()
      setNativeMarkerHidden(current, false)
      if (workspaceId === current.sourceWorkspaceId) {
        clearHighlight()
        return
      }
      if (current.failureMessage !== undefined) return
      event.preventDefault()
      event.stopPropagation()
      if (dataTransfer !== null) dataTransfer.dropEffect = 'move'
      return
    }
    const model = workspaceDialogModel(current.state)
    if (!model.canMove || workspaceId === current.state.currentWorkspaceId
      || !model.choices.some(workspace => workspace.workspaceId === workspaceId)) {
      clearHighlight()
      clearSessionMarker()
      setNativeMarkerHidden(current, false)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (dataTransfer !== null) dataTransfer.dropEffect = 'move'
    setNativeMarkerHidden(current, true)
    const pointerPosition = sessionDropPosition(event, dropTarget.container, current.sourceTree)
    const orderPlan = pointerPosition === undefined || current.state.positionSupported !== true
      ? undefined
      : nativeSessionOrderPlan(ctx, current, workspaceId, pointerPosition)
    if (orderPlan === undefined || orderPlan.error !== undefined) clearSessionMarker()
    else showSessionMarker(pointerPosition)
    clearHighlight()
    dropTarget.container.setAttribute('data-dsw-drop-target', 'true')
    highlighted = dropTarget.container
  }
  const onDrop = (event) => {
    const current = drag
    if (current === undefined) return
    const dropTarget = workspaceDropTargetFromElement(event.target, current.sourceTree)
    if (dropTarget === undefined) {
      clearHighlight()
      clearSessionMarker()
      setNativeMarkerHidden(current, false)
      return
    }
    const { workspaceId } = dropTarget
    if (current.handled) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    const state = current.state
    if (state === undefined && workspaceId === current.sourceWorkspaceId) {
      clearHighlight()
      clearSessionMarker()
      setNativeMarkerHidden(current, false)
      return
    }
    if (state !== undefined) {
      const model = workspaceDialogModel(state)
      if (!model.canMove || workspaceId === state.currentWorkspaceId
        || !model.choices.some(workspace => workspace.workspaceId === workspaceId)) {
        clearHighlight()
        clearSessionMarker()
        setNativeMarkerHidden(current, false)
        return
      }
    }
    const pointerPosition = sessionDropPosition(event, dropTarget.container, current.sourceTree)
    let orderPlan = pointerPosition === undefined || state?.positionSupported !== true
      ? undefined
      : nativeSessionOrderPlan(ctx, current, workspaceId, pointerPosition)
    event.preventDefault()
    event.stopPropagation()
    current.handled = true
    clearHighlight()
    clearSessionMarker()
    setNativeMarkerHidden(current, false)
    if (orderPlan?.error !== undefined) {
      showToast(t(orderPlan.error === 'boundary' ? 'error.order-boundary' : 'error.order-unavailable'), { error: true })
      return
    }
    void (async () => {
      const resolvedState = state ?? await current.statePromise
      if (resolvedState === undefined) {
        if (current.failureMessage !== undefined && !current.failureShown) {
          current.failureShown = true
          showToast(t('error.load', { message: current.failureMessage }), { error: true })
        }
        return
      }
      const model = workspaceDialogModel(resolvedState)
      if (!model.canMove) {
        if (model.reason !== undefined && !current.reasonShown) {
          current.reasonShown = true
          showToast(t(`reason.${model.reason}`), { error: true })
        }
        return
      }
      if (workspaceId === resolvedState.currentWorkspaceId
        || !model.choices.some(workspace => workspace.workspaceId === workspaceId)) return
      if (pointerPosition !== undefined && resolvedState.positionSupported !== true) {
        showToast(t('error.position-unsupported'), { error: true })
        return
      }
      if (pointerPosition !== undefined && orderPlan === undefined) {
        orderPlan = nativeSessionOrderPlan(ctx, current, workspaceId, pointerPosition)
      }
      if (orderPlan?.error !== undefined) {
        showToast(t(orderPlan.error === 'boundary' ? 'error.order-boundary' : 'error.order-unavailable'), { error: true })
        return
      }
      const workspace = model.choices.find(choice => choice.workspaceId === workspaceId)
      if (movingSessions.has(current.sessionId)) {
        showToast(t('error.already-moving'), { error: true })
        return
      }
      movingSessions.add(current.sessionId)
      try {
        await moveSessionSafely(
          ctx,
          t,
          resolvedState,
          workspaceId,
          orderPlan === undefined
            ? undefined
            : { anchorSessionId: orderPlan.pointerPosition.anchorSessionId, side: orderPlan.pointerPosition.side },
          orderPlan === undefined
            ? undefined
            : () => orderPlan.view.actions.setSessionOrder(orderPlan.targetWorkspaceId, orderPlan.nextOrder, orderPlan.initialOrders),
        )
        showToast(t('drag.moved', { title: workspace?.title ?? workspaceId }), { duration: 2200 })
      } catch (error) {
        if (error?.localUserMessage === true) showToast(error.message, { error: true })
        else showToast(t('error.move', { message: error instanceof Error ? error.message : String(error) }), { error: true })
      } finally {
        movingSessions.delete(current.sessionId)
      }
    })()
  }
  const onDragEnd = () => {
    clearHighlight()
    clearSessionMarker()
    setNativeMarkerHidden(drag, false)
    drag = undefined
  }

  document.addEventListener('dragstart', onDragStart, true)
  document.addEventListener('dragover', onDragOver, true)
  document.addEventListener('drop', onDrop, true)
  document.addEventListener('dragend', onDragEnd, true)
  return () => {
    document.removeEventListener('dragstart', onDragStart, true)
    document.removeEventListener('dragover', onDragOver, true)
    document.removeEventListener('drop', onDrop, true)
    document.removeEventListener('dragend', onDragEnd, true)
    clearHighlight()
    clearSessionMarker()
    setNativeMarkerHidden(drag, false)
    drag = undefined
  }
}

function installStyles() {
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = element('style')
  style.id = STYLE_ID
  style.textContent = `
.dsw-overlay{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.48)}
.dsw-menu-item{box-sizing:border-box;width:100%;min-height:32px;display:flex;align-items:center;gap:8px;padding:6px 10px;border:0;border-radius:6px;color:var(--dsw-alias-label-primary);background:transparent;text-align:left;font:inherit;cursor:pointer}.dsw-menu-item:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsw-menu-item:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}.dsw-menu-icon{width:16px;flex:none;text-align:center}
[data-dsw-drop-target="true"]{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px;background:var(--dsw-alias-interactive-bg-hover)}
[role="tree"][data-dsw-cross-workspace-drop-active="true"] [data-row-key^="session:"]::before,[role="tree"][data-dsw-cross-workspace-drop-active="true"] [data-row-key^="session:"]::after{content:none!important;display:none!important}
.dsw-session-drop-marker{box-sizing:border-box;position:fixed;z-index:1290;height:12px;pointer-events:none;background:linear-gradient(55deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 0/5px 7px no-repeat,linear-gradient(125deg,transparent calc(50% - 1px),var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px),transparent calc(50% + 1px)) 0 5px/5px 7px no-repeat,linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px/calc(100% - 4px) 2px no-repeat}
.dsw-dialog{box-sizing:border-box;width:min(480px,100%);padding:20px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv3);font-family:var(--dsw-font-family,ui-sans-serif,system-ui,sans-serif)}
.dsw-title{margin:0;font-size:18px;line-height:26px}.dsw-help{margin:6px 0 18px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}.dsw-label{display:block;margin:12px 0 6px;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}.dsw-current{min-height:20px;overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;line-height:20px;text-overflow:ellipsis;white-space:nowrap}.dsw-select{box-sizing:border-box;width:100%;min-height:44px;padding:9px 34px 9px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-input-major,var(--dsw-alias-bg-base));font:inherit;font-size:14px}.dsw-select:disabled{opacity:.55}.dsw-status{min-height:20px;margin:10px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:20px}.dsw-status[data-error=true]{color:var(--dsw-alias-state-error-primary)}.dsw-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.dsw-button{min-width:80px;min-height:40px;padding:8px 13px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);background:transparent;font:inherit;font-size:13px;cursor:pointer}.dsw-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dsw-primary{border-color:var(--dsw-alias-state-business-primary);color:#fff;background:var(--dsw-alias-state-business-primary)}.dsw-button:disabled{opacity:.5;cursor:not-allowed}.dsw-button:focus-visible,.dsw-select:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.dsw-toast{position:fixed;right:20px;bottom:20px;z-index:1350;max-width:min(420px,calc(100vw - 40px));padding:11px 14px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-label-primary);background:var(--dsw-specific-menu,var(--dsw-alias-bg-base));box-shadow:var(--dsw-shadow-lv2);font:13px/20px var(--dsw-font-family,ui-sans-serif,system-ui,sans-serif)}
@media(max-width:600px){.dsw-overlay{align-items:flex-end;padding:12px}.dsw-dialog{padding:18px}.dsw-button{min-height:44px;flex:1}.dsw-actions{width:100%}}
@media(prefers-reduced-motion:reduce){.dsw-dialog,.dsw-toast{scroll-behavior:auto}}
`
  document.head.appendChild(style)
  return () => style.remove()
}

export function apply(ctx) {
  const t = ctx.locale.bind(NS)
  ctx.effect(installStyles)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  if (hasModernSessionMenuSlot(ctx)) ctx.effect(() => registerSessionMenu(ctx, t))
  else ctx.effect(() => installLegacyMenuFallback(ctx, t))
  ctx.effect(() => installSessionDragAndDrop(ctx, t))
}
