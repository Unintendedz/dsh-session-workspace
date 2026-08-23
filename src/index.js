import { moveSessionWorkspace, WorkspaceMoveError } from './migration.js'

export const name = 'dsh-session-workspace'
export const inject = ['connection', 'agents', 'sessions', 'sessionPersistence', 'workspaceRegistry']

function assertStatePayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)
    || Object.keys(payload).some(key => key !== 'sessionId')
    || typeof payload.sessionId !== 'string' || payload.sessionId.trim() === '') {
    throw new WorkspaceMoveError('bad-request', 'state payload requires only a non-empty sessionId')
  }
}

export async function sessionWorkspaceState(ctx, payload) {
  assertStatePayload(payload)
  const { sessionId } = payload
  const live = ctx.sessions.get(sessionId)
  const header = live?.header
    ?? (await ctx.sessionPersistence.list()).find(candidate => candidate.id === sessionId)
  if (header === undefined) {
    throw new WorkspaceMoveError('session-not-found', `session ${JSON.stringify(sessionId)} was not found`)
  }
  const workspaces = ctx.workspaceRegistry.list()
  const current = workspaces.find(workspace => workspace.sessionIds.includes(sessionId))
  return {
    sessionId,
    currentWorkspaceId: current?.id,
    currentPath: header.cwd,
    active: live !== undefined || ctx.agents.get(sessionId) !== undefined,
    supported: ctx.sessionPersistence.supportsRawArtifacts
      && typeof ctx.sessionPersistence.readRaw === 'function'
      && typeof ctx.workspaceRegistry.replaceHeaderIndex === 'function',
    workspaces: workspaces.map(workspace => ({
      workspaceId: workspace.id,
      title: workspace.title,
      path: workspace.path,
    })),
  }
}

export function createRpcHandler(ctx) {
  return async (endpoint, payload) => {
    try {
      if (endpoint !== 'state' && endpoint !== 'move') {
        throw new WorkspaceMoveError('bad-request', `unknown dsh-session-workspace endpoint ${JSON.stringify(endpoint)}`)
      }
      return {
        ok: true,
        value: endpoint === 'state'
          ? await sessionWorkspaceState(ctx, payload)
          : await moveSessionWorkspace(ctx, payload),
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: error instanceof WorkspaceMoveError ? error.code : 'internal',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    }
  }
}

export function apply(ctx) {
  ctx.effect(
    () => ctx.connection.rpc.handle(
      '/dsh-session-workspace',
      createRpcHandler(ctx),
      { authority: 'trusted-host' },
    ),
    'dsh-session-workspace: rpc',
  )
}
