import assert from 'node:assert/strict'
import test from 'node:test'

import { createRpcHandler, sessionWorkspaceState } from '../src/index.js'
import { sessionIdFromElement, workspaceDialogModel } from '../src/client.js'

function context({ active = false } = {}) {
  const oldWorkspace = {
    id: 'old', path: '/projects/old', title: 'Old', sessionIds: ['session-one'],
  }
  const newWorkspace = {
    id: 'new', path: '/projects/new', title: 'New', sessionIds: [],
  }
  return {
    sessions: {
      get: id => active && id === 'session-one'
        ? { id, header: { id, cwd: '/projects/old' } }
        : undefined,
    },
    agents: { get: id => active && id === 'session-one' ? { id } : undefined },
    sessionPersistence: {
      supportsRawArtifacts: true,
      async readRaw() { throw new Error('not used by state') },
      async list() { return [{ id: 'session-one', cwd: '/projects/old' }] },
    },
    workspaceRegistry: {
      replaceHeaderIndex() {},
      list: () => [oldWorkspace, newWorkspace],
      get: id => [oldWorkspace, newWorkspace].find(workspace => workspace.id === id),
    },
  }
}

test('sessionWorkspaceState reports the current workspace and active safety gate', async () => {
  assert.deepEqual(await sessionWorkspaceState(context({ active: true }), { sessionId: 'session-one' }), {
    sessionId: 'session-one',
    currentWorkspaceId: 'old',
    currentPath: '/projects/old',
    active: true,
    supported: true,
    workspaces: [
      { workspaceId: 'old', title: 'Old', path: '/projects/old' },
      { workspaceId: 'new', title: 'New', path: '/projects/new' },
    ],
  })
})

test('RPC handler returns stable business errors', async () => {
  const rpc = createRpcHandler(context())
  assert.deepEqual(await rpc('unknown', {}), {
    ok: false,
    error: { code: 'bad-request', message: 'unknown dsh-session-workspace endpoint "unknown"' },
  })
  const missing = await rpc('move', { sessionId: 'session-one', workspaceId: 'missing' })
  assert.equal(missing.ok, false)
  assert.equal(missing.error.code, 'workspace-not-found')
})

test('workspaceDialogModel excludes the current workspace and gates active sessions', () => {
  const state = {
    currentWorkspaceId: 'old',
    active: true,
    supported: true,
    workspaces: [
      { workspaceId: 'old', title: 'Old', path: '/projects/old' },
      { workspaceId: 'new', title: 'New', path: '/projects/new' },
    ],
  }
  assert.deepEqual(workspaceDialogModel(state), {
    canMove: false,
    reason: 'session-active',
    choices: [{ workspaceId: 'new', title: 'New', path: '/projects/new' }],
  })
  assert.deepEqual(workspaceDialogModel({ ...state, active: false }), {
    canMove: true,
    reason: undefined,
    choices: [{ workspaceId: 'new', title: 'New', path: '/projects/new' }],
  })
})

test('sessionIdFromElement follows the owning React fiber without reading row text', () => {
  const element = {
    '__reactFiber$test': {
      memoizedProps: {},
      return: {
        memoizedProps: { node: { id: 'session-one' } },
        return: null,
      },
    },
  }
  assert.equal(sessionIdFromElement(element), 'session-one')
  assert.equal(sessionIdFromElement({}), undefined)
})
