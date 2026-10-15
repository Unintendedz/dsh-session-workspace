import assert from 'node:assert/strict'
import test from 'node:test'
import { access, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { moveSessionWorkspace } from '../src/migration.js'

const native = { skip: !process.env.DSH_NATIVE_ROOT && 'set DSH_NATIVE_ROOT for native persistence tests' }
const nativeImport = name => import(pathToFileURL(join(process.env.DSH_NATIVE_ROOT, 'node_modules/@deepseek-ai', name, 'lib/index.js')))

async function contextFor(root, compression) {
  const [
    { Context },
    { default: Storage },
    StorageJson,
    StorageDomain,
    { default: Persistence },
    { default: WorkspaceRegistry },
  ] = await Promise.all([
    nativeImport('cordis'),
    nativeImport('dsh-storage'),
    nativeImport('dsh-storage-json'),
    nativeImport('dsh-storage-domain'),
    nativeImport('dsh-session-persistence-jsonl'),
    nativeImport('dsh-workspace'),
  ])
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'storages') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(Persistence, { root: join(root, 'sessions'), compression })
  return { ctx, WorkspaceRegistry }
}

async function seedSession(ctx, id, cwd) {
  const { Session, SESSION_FORMAT_VERSION } = await nativeImport('dsh-session')
  const session = Session.create(id, [], {
    id,
    version: SESSION_FORMAT_VERSION,
    createdAt: 42,
    isSeeded: false,
    delegationDepth: 0,
    cwd,
  })
  session.append('session/title', { title: `Synthetic ${id}`, messageSeqs: [], source: { kind: 'user' } })
  session.append('user/message', {
    id: `${id}-user`,
    role: 'user',
    source: { kind: 'user' },
    content: [{ type: 'text', text: `完整历史 ${id} 🧪\nsecond line` }],
  }, { surfaceOp: 'append' })
  const events = session.snapshotEvents()
  const handle = await ctx.sessionPersistence.create(session.header)
  try {
    // Multiple batches produce distinct append frames under zstd compression.
    await handle.append(events.slice(0, 1))
    await handle.append(events.slice(1, 2))
    await handle.append(events.slice(2))
  } finally {
    await handle.close()
  }
  return { header: session.header, events }
}

async function startRegistry(ctx, WorkspaceRegistry) {
  await ctx.plugin(WorkspaceRegistry)
  return ctx.workspaceRegistry
}

async function setWorkspaceOrder(workspace, sessionIds) {
  for (let index = sessionIds.length - 1; index >= 0; index--) {
    await workspace.insertSessionBefore(sessionIds[index], sessionIds[index + 1])
  }
}

function migrationContext(ctx) {
  return {
    sessionPersistence: ctx.sessionPersistence,
    workspaceRegistry: ctx.workspaceRegistry,
    sessions: { get: () => undefined },
    agents: { get: () => undefined },
  }
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function zstdFrameCount(bytes) {
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  let count = 0
  let offset = 0
  while ((offset = bytes.indexOf(magic, offset)) !== -1) {
    count++
    offset += magic.length
  }
  return count
}

for (const compression of ['none', 'zstd']) test(`native registry move survives a full ${compression} restart`, native, async () => {
  const root = await mkdtemp(join(tmpdir(), `dsh-workspace-registry-${compression}-`))
  const sourcePath = join(root, 'source-workspace')
  const targetPath = join(root, 'target-workspace')
  await mkdir(sourcePath)
  await mkdir(targetPath)
  let ctx
  try {
    let stack = await contextFor(root, compression)
    ctx = stack.ctx
    const movedId = `registry-move-${compression}`
    const archivedId = `registry-archive-${compression}`
    const expected = await seedSession(ctx, movedId, sourcePath)
    await seedSession(ctx, archivedId, sourcePath)
    const registry = await startRegistry(ctx, stack.WorkspaceRegistry)
    const [source] = registry.list()
    assert.ok(source, 'bootstrap should register the seeded source workspace')
    assert.deepEqual(new Set(source.sessionIds), new Set([movedId, archivedId]))
    const target = await registry.create(targetPath, 'Target workspace')
    await registry.pinSession(movedId)
    await registry.archiveSession(archivedId)

    const sourceArtifact = ctx.sessionPersistence.locate(expected.header).path
    if (compression === 'zstd') {
      assert.ok(zstdFrameCount(await readFile(sourceArtifact)) >= 3, 'fixture must contain multiple zstd append frames')
    }

    const result = await moveSessionWorkspace(migrationContext(ctx), {
      sessionId: movedId,
      workspaceId: target.id,
    })
    assert.equal(result.sessionId, movedId)
    assert.deepEqual(source.sessionIds, [archivedId])
    assert.deepEqual(target.sessionIds, [movedId])

    await ctx.fiber.dispose()
    ctx = undefined

    stack = await contextFor(root, compression)
    ctx = stack.ctx
    const reopenedRegistry = await startRegistry(ctx, stack.WorkspaceRegistry)
    const reopenedSource = reopenedRegistry.get(source.id)
    const reopenedTarget = reopenedRegistry.get(target.id)
    assert.deepEqual(reopenedSource.sessionIds, [archivedId])
    assert.deepEqual(reopenedTarget.sessionIds, [movedId])
    assert.deepEqual(reopenedRegistry.pinnedSessionIds, [movedId])
    assert.deepEqual(reopenedRegistry.archivedSessionIds, [archivedId])

    const reopened = await ctx.sessionPersistence.open(movedId, 'read')
    try {
      assert.equal(reopened.header.id, movedId)
      assert.equal(reopened.header.cwd, reopenedTarget.path)
      assert.deepEqual((await reopened.read()).events, expected.events)
    } finally {
      await reopened.close()
    }

    const writer = await ctx.sessionPersistence.open(movedId, 'write')
    const appended = structuredClone(expected.events[2])
    appended.seq = expected.events.length
    appended.time = Math.max(Date.now(), expected.events.at(-1).time + 1)
    appended.data.id = `${movedId}-after-restart`
    appended.data.content = [{ type: 'text', text: 'append after the full context restart' }]
    try {
      await writer.append([appended])
    } finally {
      await writer.close()
    }
    const afterAppend = await ctx.sessionPersistence.open(movedId, 'read')
    try {
      const events = (await afterAppend.read()).events
      assert.deepEqual(events.slice(0, expected.events.length), expected.events)
      assert.deepEqual(events.at(-1), appended)
    } finally {
      await afterAppend.close()
    }
  } finally {
    await ctx?.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test('native registry restores durable membership and source artifact after target attach failure', native, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-registry-rollback-'))
  const sourcePath = join(root, 'source-workspace')
  const targetPath = join(root, 'target-workspace')
  await mkdir(sourcePath)
  await mkdir(targetPath)
  let ctx
  try {
    let stack = await contextFor(root, 'none')
    ctx = stack.ctx
    const id = 'registry-rollback-session'
    const { header } = await seedSession(ctx, id, sourcePath)
    const registry = await startRegistry(ctx, stack.WorkspaceRegistry)
    const [source] = registry.list()
    const target = await registry.create(targetPath, 'Target workspace')
    const sourceArtifact = ctx.sessionPersistence.locate(header).path
    const destinationArtifact = ctx.sessionPersistence.locate({ ...header, cwd: targetPath }).path
    const originalBytes = await readFile(sourceArtifact)
    const originalAttach = target.attachSession
    target.attachSession = async () => { throw new Error('controlled target attachment failure') }

    await assert.rejects(
      moveSessionWorkspace(migrationContext(ctx), { sessionId: id, workspaceId: target.id }),
      /controlled target attachment failure/,
    )
    target.attachSession = originalAttach
    assert.deepEqual(await readFile(sourceArtifact), originalBytes)
    assert.equal(await exists(destinationArtifact), false)
    assert.deepEqual(source.sessionIds, [id])
    assert.deepEqual(target.sessionIds, [])

    await ctx.fiber.dispose()
    ctx = undefined
    stack = await contextFor(root, 'none')
    ctx = stack.ctx
    const reopenedRegistry = await startRegistry(ctx, stack.WorkspaceRegistry)
    assert.deepEqual(reopenedRegistry.get(source.id).sessionIds, [id])
    assert.deepEqual(reopenedRegistry.get(target.id).sessionIds, [])
    const reopened = await ctx.sessionPersistence.open(id, 'read')
    try {
      assert.equal(reopened.header.id, id)
      assert.equal(reopened.header.cwd, sourcePath)
    } finally {
      await reopened.close()
    }
  } finally {
    await ctx?.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test('native registry persists before/after middle insertion and restores ordering on rollback', native, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-registry-position-'))
  const sourcePath = join(root, 'source-workspace')
  const targetPath = join(root, 'target-workspace')
  await mkdir(sourcePath)
  await mkdir(targetPath)
  const targetIds = ['position-target-first', 'position-target-middle', 'position-target-last']
  const beforeId = 'position-move-before'
  const afterId = 'position-move-after'
  const sourceIds = ['position-source-first', 'position-rollback', beforeId, afterId, 'position-source-last', 'position-invalid-anchor']
  const movedIds = [beforeId, afterId]
  let ctx
  try {
    let stack = await contextFor(root, 'none')
    ctx = stack.ctx
    const expectedEvents = new Map()
    for (const id of new Set([...targetIds, ...sourceIds, ...movedIds])) {
      const { events } = await seedSession(ctx, id, targetIds.includes(id) ? targetPath : sourcePath)
      expectedEvents.set(id, events)
    }
    let registry = await startRegistry(ctx, stack.WorkspaceRegistry)
    let source = registry.list().find(workspace => workspace.sessionIds.includes(sourceIds[0]))
    let target = registry.list().find(workspace => workspace.sessionIds.includes(targetIds[0]))
    assert.ok(source, JSON.stringify(registry.list().map(workspace => ({ id: workspace.id, path: workspace.path, sessionIds: workspace.sessionIds }))))
    assert.ok(target, JSON.stringify(registry.list().map(workspace => ({ id: workspace.id, path: workspace.path, sessionIds: workspace.sessionIds }))))
    const sourceId = source.id
    const targetId = target.id
    const targetWorkspacePath = target.path
    await setWorkspaceOrder(source, sourceIds)
    await setWorkspaceOrder(target, targetIds)
    assert.deepEqual(source.sessionIds, sourceIds)
    assert.deepEqual(target.sessionIds, targetIds)

    const invalidHandle = await ctx.sessionPersistence.open('position-invalid-anchor', 'read')
    const invalidHeader = invalidHandle.header
    await invalidHandle.close()
    const invalidPath = ctx.sessionPersistence.locate(invalidHeader).path
    const invalidOriginalBytes = await readFile(invalidPath)
    const sourceBeforeInvalid = [...source.sessionIds]
    const targetBeforeInvalid = [...target.sessionIds]
    await assert.rejects(moveSessionWorkspace(migrationContext(ctx), {
      sessionId: 'position-invalid-anchor',
      workspaceId: targetId,
      position: { anchorSessionId: 'not-in-target', side: 'before' },
    }), error => error.code === 'workspace-anchor-not-found')
    assert.deepEqual(await readFile(invalidPath), invalidOriginalBytes)
    assert.deepEqual(source.sessionIds, sourceBeforeInvalid)
    assert.deepEqual(target.sessionIds, targetBeforeInvalid)

    const rollbackHandle = await ctx.sessionPersistence.open('position-rollback', 'read')
    const rollbackHeader = rollbackHandle.header
    await rollbackHandle.close()
    const rollbackPath = ctx.sessionPersistence.locate(rollbackHeader).path
    const rollbackBytes = await readFile(rollbackPath)
    const sourceBeforeRollback = [...source.sessionIds]
    const targetBeforeRollback = [...target.sessionIds]
    const insertSessionBefore = target.insertSessionBefore
    target.insertSessionBefore = async (sessionId, beforeSessionId) => {
      if (sessionId === 'position-rollback') throw new Error('controlled native ordering failure')
      return insertSessionBefore.call(target, sessionId, beforeSessionId)
    }
    await assert.rejects(moveSessionWorkspace(migrationContext(ctx), {
      sessionId: 'position-rollback',
      workspaceId: targetId,
      position: { anchorSessionId: targetIds[1], side: 'after' },
    }), /controlled native ordering failure/)
    target.insertSessionBefore = insertSessionBefore
    assert.deepEqual(await readFile(rollbackPath), rollbackBytes)
    assert.deepEqual(source.sessionIds, sourceBeforeRollback)
    assert.deepEqual(target.sessionIds, targetBeforeRollback)

    await moveSessionWorkspace(migrationContext(ctx), {
      sessionId: beforeId,
      workspaceId: targetId,
      position: { anchorSessionId: targetIds[1], side: 'before' },
    })
    await moveSessionWorkspace(migrationContext(ctx), {
      sessionId: afterId,
      workspaceId: targetId,
      position: { anchorSessionId: targetIds[1], side: 'after' },
    })
    const targetAfterMoves = [targetIds[0], beforeId, targetIds[1], afterId, targetIds[2]]
    assert.deepEqual(target.sessionIds, targetAfterMoves)

    await ctx.fiber.dispose()
    ctx = undefined
    stack = await contextFor(root, 'none')
    ctx = stack.ctx
    registry = await startRegistry(ctx, stack.WorkspaceRegistry)
    source = registry.get(sourceId)
    target = registry.get(targetId)
    assert.deepEqual(target.sessionIds, targetAfterMoves)
    assert.deepEqual(source.sessionIds, sourceBeforeRollback.filter(id => !movedIds.includes(id)))

    for (const id of [...movedIds, 'position-rollback', 'position-invalid-anchor']) {
      const reopened = await ctx.sessionPersistence.open(id, 'read')
      try {
        assert.equal(reopened.header.id, id)
        assert.equal(reopened.header.cwd, movedIds.includes(id) ? targetWorkspacePath : sourcePath)
        assert.deepEqual((await reopened.read()).events, expectedEvents.get(id))
      } finally {
        await reopened.close()
      }
    }
  } finally {
    await ctx?.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
