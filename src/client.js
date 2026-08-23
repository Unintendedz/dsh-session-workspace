const NS = 'dsh-session-workspace'
const STYLE_ID = 'dsh-session-workspace-style'
const RPC_PATH = '/dsh-session-workspace'

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
  'reason.session-active': '这个会话仍处于活动状态。请先切换到另一个会话，待它关闭后再移动。',
  'reason.unsupported': '当前 DSH 版本或持久化后端不支持安全迁移。',
  'reason.no-targets': '没有其他可用工作区。',
  'error.load': '无法读取工作区：{message}',
  'error.move': '移动失败：{message}',
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
  'reason.session-active': 'This session is still active. Switch to another session, wait for it to close, then try again.',
  'reason.unsupported': 'This DSH version or persistence backend cannot move sessions safely.',
  'reason.no-targets': 'No other workspace is available.',
  'error.load': 'Could not load workspaces: {message}',
  'error.move': 'Move failed: {message}',
}

export const inject = ['locale', 'connection']

export function workspaceDialogModel(state) {
  const choices = state.workspaces.filter(workspace => workspace.workspaceId !== state.currentWorkspaceId)
  const reason = state.active
    ? 'session-active'
    : !state.supported
      ? 'unsupported'
      : choices.length === 0 ? 'no-targets' : undefined
  return { canMove: reason === undefined, reason, choices }
}

export function sessionIdFromElement(element) {
  const key = Object.getOwnPropertyNames(element).find(name => name.startsWith('__reactFiber$'))
  let fiber = key === undefined ? undefined : element[key]
  for (let depth = 0; fiber !== undefined && fiber !== null && depth < 64; depth += 1) {
    const sessionId = fiber.memoizedProps?.node?.id
    if (typeof sessionId === 'string' && sessionId.trim() !== '') return sessionId
    fiber = fiber.return
  }
  return undefined
}

function resultError(result) {
  return result?.ok === false && typeof result.error?.message === 'string'
    ? result.error.message
    : 'unknown error'
}

function nearestMenu(anchor) {
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

function svgElement(name, attributes) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  return element
}

function moveIcon() {
  const svg = svgElement('svg', {
    width: '16', height: '16', viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true',
  })
  svg.appendChild(svgElement('path', {
    d: 'M2.5 4.5h4l1.2 1.4h5.8v6.6h-11z', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linejoin': 'round',
  }))
  svg.appendChild(svgElement('path', {
    d: 'M5 9h5m-1.7-1.7L10 9l-1.7 1.7', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }))
  return svg
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
    busy = true
    select.disabled = true
    cancel.disabled = true
    confirm.disabled = true
    status.dataset.error = 'false'
    status.textContent = t('dialog.moving')
    const workspace = model.choices.find(choice => choice.workspaceId === select.value)
    try {
      const result = await ctx.connection.rpc.call(RPC_PATH, 'move', {
        sessionId,
        workspaceId: select.value,
      })
      if (!result?.ok) throw new Error(resultError(result))
      status.textContent = t('dialog.moved', { title: workspace?.title ?? select.value })
      busy = false
      setTimeout(close, 700)
    } catch (error) {
      busy = false
      select.disabled = false
      cancel.disabled = false
      confirm.disabled = false
      status.dataset.error = 'true'
      status.textContent = t('error.move', { message: error instanceof Error ? error.message : String(error) })
      select.focus()
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
    const message = t('error.load', { message: error instanceof Error ? error.message : String(error) })
    const toast = element('div', 'dsw-toast', message)
    toast.setAttribute('role', 'alert')
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
  }
}

function mountMenuItem(ctx, anchor, sessionId, t) {
  const menu = nearestMenu(anchor)
  if (menu === undefined) return false
  if (menu.querySelector('[data-dsh-session-workspace]') !== null) return true
  const template = menu.querySelector('[role="menuitem"]')
  if (template === null) return false
  const item = template.cloneNode(false)
  item.dataset.dshSessionWorkspace = sessionId
  const icon = element('span')
  icon.className = template.firstElementChild?.className ?? ''
  icon.appendChild(moveIcon())
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

function installMenu(ctx, t) {
  const onClick = (event) => {
    const target = event.target
    if (typeof target?.closest !== 'function') return
    const button = target.closest('button')
    if (button === null || button.closest('[role="treeitem"]') === null) return
    const sessionId = sessionIdFromElement(button)
    if (sessionId === undefined) return
    let attempt = 0
    const mount = () => {
      if (mountMenuItem(ctx, button, sessionId, t)) return
      attempt += 1
      if (attempt < 5) setTimeout(mount, 20)
    }
    setTimeout(mount, 0)
  }
  document.addEventListener('click', onClick, true)
  return () => document.removeEventListener('click', onClick, true)
}

function installStyles() {
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = element('style')
  style.id = STYLE_ID
  style.textContent = `
.dsw-overlay{position:fixed;inset:0;z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.48)}
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
  ctx.effect(() => installMenu(ctx, t))
}
