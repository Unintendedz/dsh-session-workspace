import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { zstdCompressSync } from 'node:zlib'
import { moveSessionWorkspace } from '../src/migration.js'
import { sessionWorkspaceState } from '../src/index.js'

const native = { skip: !process.env.DSH_NATIVE_ROOT && 'set DSH_NATIVE_ROOT for native persistence tests' }

async function fixture({ compression = 'none', failAttach = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-native-'))
  const oldPath = join(root, 'old-workspace'), newPath = join(root, 'new-workspace')
  await mkdir(oldPath); await mkdir(newPath)
  const nativeImport = name => import(pathToFileURL(`${process.env.DSH_NATIVE_ROOT}/node_modules/@deepseek-ai/${name}/lib/index.js`))
  const { Context } = await nativeImport('cordis')
  const { default: Persistence } = await nativeImport('dsh-session-persistence-jsonl')
  const { Session, SESSION_FORMAT_VERSION } = await nativeImport('dsh-session')
  const owner = new Context()
  const peer = new Context()
  new Persistence(owner, { root: join(root, 'sessions'), compression })
  new Persistence(peer, { root: join(root, 'sessions'), compression })
  const id = 'synthetic-session'
  const session = Session.create(id, [], { id, version: SESSION_FORMAT_VERSION, createdAt: 1, isSeeded: false, delegationDepth: 0, cwd: oldPath })
  session.append('session/title', { title: 'Synthetic title', messageSeqs: [], source: { kind: 'user' } })
  session.append('user/message', { id: 'message-native', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '完整历史 🧪\nsecond line' }] }, { surfaceOp: 'append' })
  const stored = await owner.sessionPersistence.create(session.header)
  const expectedEvents = [...session.snapshotEvents(), { type: 'workspace-test/metadata', seq: session.seq, time: 10, data: { text: 'Preserve this payload' }, ignorable: true }]
  await stored.append(expectedEvents.slice(0, 2))
  await stored.append(expectedEvents.slice(2))
  await stored.close()
  const source = owner.sessionPersistence.locate(session.header).path
  const sourceBytes = await readFile(source)
  const oldGeneration = join(dirname(source), compression === 'zstd' ? 'session.jsonl.zstd' : 'session.jsonl')
  const oldText = Buffer.from(JSON.stringify({ type: 'session', version: 0, id, createdAt: 1, delegationDepth: 0, cwd: oldPath }) + '\n')
  const oldBytes = compression === 'zstd' ? zstdCompressSync(oldText) : oldText
  await writeFile(oldGeneration, oldBytes)
  const headers = new Map([[id, session.header]])
  const oldIds = [id], newIds = []
  const workspace = (workspaceId, path, ids, fails = false) => ({
    id: workspaceId, path, title: workspaceId, get sessionIds() { return [...ids] },
    async detachSession(sessionId) { const index = ids.indexOf(sessionId); if (index !== -1) ids.splice(index, 1) },
    async attachSession(sessionId) {
      if (fails) throw new Error('synthetic target attachment failure')
      assert.equal(headers.get(sessionId).cwd, path)
      if (!ids.includes(sessionId)) ids.push(sessionId)
    },
    async insertSessionBefore(sessionId, beforeSessionId) {
      assert.ok(ids.includes(sessionId))
      if (beforeSessionId !== undefined) assert.ok(ids.includes(beforeSessionId))
      const without = ids.filter(id => id !== sessionId)
      const index = beforeSessionId === undefined ? without.length : without.indexOf(beforeSessionId)
      ids.splice(0, ids.length, ...without.slice(0, index), sessionId, ...without.slice(index))
    },
  })
  const workspaces = [workspace('old', oldPath, oldIds), workspace('new', newPath, newIds, failAttach)]
  const ctx = {
    sessionPersistence: owner.sessionPersistence,
    sessions: { get: () => undefined }, agents: { get: () => undefined },
    workspaceRegistry: {
      list: () => workspaces, get: id => workspaces.find(w => w.id === id),
      async replaceHeaderIndex(values) { headers.clear(); for (const header of values) headers.set(header.id, header) },
    },
  }
  return {
    root, id, source, sourceBytes, oldGeneration, oldBytes, oldPath, newPath, ctx, peer, oldIds, newIds, expectedEvents,
    async dispose() { await peer.fiber.dispose(); await owner.fiber.dispose(); await rm(root, { recursive: true, force: true }) },
  }
}

test('workspace state reads the current native snapshot header without opening the session', native, async () => {
  const f = await fixture()
  try {
    const state = await sessionWorkspaceState(f.ctx, { sessionId: f.id })
    assert.equal(state.currentPath, f.oldPath)
    assert.equal(state.currentWorkspaceId, 'old')
    assert.equal(state.supported, true)
    assert.equal(state.active, false)
  } finally { await f.dispose() }
})

for (const compression of ['none', 'zstd']) test(`moving native ${compression} storage preserves events and backs up all original generations`, native, async () => {
  const f = await fixture({ compression })
  try {
    const result = await moveSessionWorkspace(f.ctx, { sessionId: f.id, workspaceId: 'new' })
    assert.equal(result.path, f.newPath)
    assert.deepEqual(await readFile(result.backupPath), f.sourceBytes)
    assert.deepEqual(await readFile(join(dirname(result.backupPath), basename(f.oldGeneration))), f.oldBytes)
    const reopened = await f.peer.sessionPersistence.open(f.id, 'read')
    assert.equal(reopened.header.cwd, f.newPath)
    assert.equal(reopened.header.id, f.id)
    assert.deepEqual((await reopened.read()).events, f.expectedEvents)
    await reopened.close()
    assert.deepEqual(f.oldIds, [])
    assert.deepEqual(f.newIds, [f.id])
    assert.ok(!(await readdir(dirname(f.source))).some(name => name.endsWith('.jsonl') || name.endsWith('.jsonl.zstd')))
  } finally { await f.dispose() }
})

test('moving a session held by another native writer is refused without changing artifacts', native, async () => {
  const f = await fixture()
  let handle
  try {
    handle = await f.peer.sessionPersistence.open(f.id, 'write')
    await assert.rejects(moveSessionWorkspace(f.ctx, { sessionId: f.id, workspaceId: 'new' }), /owned|active|in use/)
    assert.deepEqual(await readFile(f.source), f.sourceBytes)
    assert.deepEqual(await readFile(f.oldGeneration), f.oldBytes)
  } finally { await handle?.close(); await f.dispose() }
})

test('native move rolls back every generation and workspace account if attachment fails', native, async () => {
  const f = await fixture({ failAttach: true })
  try {
    await assert.rejects(moveSessionWorkspace(f.ctx, { sessionId: f.id, workspaceId: 'new' }), /synthetic target attachment failure/)
    assert.deepEqual(await readFile(f.source), f.sourceBytes)
    assert.deepEqual(await readFile(f.oldGeneration), f.oldBytes)
    const reopened = await f.peer.sessionPersistence.open(f.id, 'read')
    assert.equal(reopened.header.cwd, f.oldPath)
    await reopened.close()
    assert.deepEqual(f.oldIds, [f.id])
    assert.deepEqual(f.newIds, [])
  } finally { await f.dispose() }
})
