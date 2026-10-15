import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'
import { moveSessionWorkspace } from '../src/migration.js'

const nativeRoot = process.env.DSH_NATIVE_ROOT
const native = { skip: !nativeRoot && 'set DSH_NATIVE_ROOT for exact Native lifecycle tests' }
const nativeImport = name => import(pathToFileURL(join(nativeRoot, 'node_modules/@deepseek-ai', name, 'lib/index.js')))

if (nativeRoot) {
  // Test-only alias to the exact installed SDK package; production resolves it through ctx.loader.
  const appBootUrl = pathToFileURL(join(nativeRoot, 'node_modules/@deepseek-ai/dsh-app-boot/lib/index.js')).href
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === '@deepseek-ai/dsh-app-boot') return { url: appBootUrl, shortCircuit: true }
      return nextResolve(specifier, context)
    },
  })
}

const { inspectLiveSession, releaseLiveSession, LiveSessionError } = await import('../src/live-session.js')

async function contextFor(root, compression) {
  const [
    { Context },
    { default: Storage },
    StorageJson,
    StorageDomain,
    { default: SessionProjectionRegistry },
    { default: SessionStore },
    { default: Persistence },
    { default: WorkspaceRegistry },
    { default: AgentRegistry },
    { default: LlmRuntime },
    { default: SystemPrompt },
    { default: ToolRuntime },
    { default: AgentLoop },
    { Session, SESSION_FORMAT_VERSION },
  ] = await Promise.all([
    nativeImport('cordis'),
    nativeImport('dsh-storage'),
    nativeImport('dsh-storage-json'),
    nativeImport('dsh-storage-domain'),
    nativeImport('dsh-session-projection'),
    nativeImport('dsh-session'),
    nativeImport('dsh-session-persistence-jsonl'),
    nativeImport('dsh-workspace'),
    nativeImport('dsh-agent'),
    nativeImport('dsh-llm'),
    nativeImport('dsh-system-prompt'),
    nativeImport('dsh-tools'),
    nativeImport('dsh-agent-loop'),
    nativeImport('dsh-session'),
  ])
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root: join(root, 'storages') })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SessionStore)
  await ctx.plugin(Persistence, { root: join(root, 'sessions'), compression })
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentLoop, { agents: [] })
  return { ctx, Session, SESSION_FORMAT_VERSION, WorkspaceRegistry }
}

async function seedSession(ctx, Session, SESSION_FORMAT_VERSION, id, cwd) {
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
    id: `${id}-user-1`,
    role: 'user',
    source: { kind: 'user' },
    content: [{ type: 'text', text: `isolated history ${id} part one` }],
  }, { surfaceOp: 'append' })
  session.append('user/message', {
    id: `${id}-user-2`,
    role: 'user',
    source: { kind: 'user' },
    content: [{ type: 'text', text: `isolated history ${id} part two` }],
  }, { surfaceOp: 'append' })
  const events = session.snapshotEvents()
  const writer = await ctx.sessionPersistence.create(session.header)
  try {
    // Separate append calls yield multiple Native zstd frames in compressed fixtures.
    for (const event of events) await writer.append([event])
  } finally {
    await writer.close()
  }
  return { header: session.header, events }
}

function fixtureUser(id) {
  return {
    id,
    role: 'user',
    source: { kind: 'user' },
    content: [{ type: 'text', text: `input ${id}` }],
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

function eventBodyBytes(artifact, path) {
  let decoded = artifact
  if (path.endsWith('.zstd')) {
    const frames = []
    let offset = 0
    while (offset < artifact.length) {
      const frame = zstdDecompressSync(artifact.subarray(offset), { info: true })
      const consumed = frame.engine.bytesWritten
      assert.ok(Number.isSafeInteger(consumed) && consumed > 0 && consumed <= artifact.length - offset, 'every Native zstd frame must decode fully')
      frames.push(frame.buffer)
      offset += consumed
    }
    decoded = Buffer.concat(frames)
  }
  const headerEnd = decoded.indexOf(0x0a)
  assert.notEqual(headerEnd, -1, 'decoded Native persistence artifact must contain its header row')
  return decoded.subarray(headerEnd + 1)
}

async function readEvents(ctx, id) {
  const handle = await ctx.sessionPersistence.open(id, 'read')
  try {
    return (await handle.read()).events
  } finally {
    await handle.close()
  }
}

function migrationContext(ctx) {
  return {
    sessionPersistence: ctx.sessionPersistence,
    workspaceRegistry: ctx.workspaceRegistry,
    sessions: ctx.sessions,
    agents: ctx.agents,
  }
}

test('live release preserves two idle agents, closes one Native writer, and resumes the same id after move', native, async () => {
  for (const compression of ['none', 'zstd']) {
    const root = await mkdtemp(join(tmpdir(), `dsh-live-session-${compression}-`))
    const sourcePath = join(root, 'source-workspace')
    const targetPath = join(root, 'target-workspace')
    await mkdir(sourcePath)
    await mkdir(targetPath)
    let ctx
    let oldHandle
    let controlHandle
    let resumedHandle
    try {
      const stack = await contextFor(root, compression)
      ctx = stack.ctx
      const id = `live-release-${compression}`
      const controlId = `live-control-${compression}`
      const original = await seedSession(ctx, stack.Session, stack.SESSION_FORMAT_VERSION, id, sourcePath)
      const controlOriginal = await seedSession(ctx, stack.Session, stack.SESSION_FORMAT_VERSION, controlId, sourcePath)
      await ctx.plugin(stack.WorkspaceRegistry)
      const [sourceWorkspace] = ctx.workspaceRegistry.list()
      assert.ok(sourceWorkspace, 'Native workspace bootstrap should find both seeded histories')
      assert.deepEqual(new Set(sourceWorkspace.sessionIds), new Set([id, controlId]))
      const targetWorkspace = await ctx.workspaceRegistry.create(targetPath, 'Live target')

      oldHandle = await ctx.agents.resume({ resumeSessionId: id, agentOptions: { provider: 'fixture', model: 'fixture' } })
      controlHandle = await ctx.agents.resume({ resumeSessionId: controlId, agentOptions: { provider: 'fixture', model: 'fixture' } })
      const oldAgent = oldHandle.agent
      const controlAgent = controlHandle.agent
      await Promise.all([oldAgent.whenIdle(), controlAgent.whenIdle()])
      assert.equal(oldAgent.status, 'idle')
      assert.equal(oldAgent.phase.kind, 'idle')
      assert.deepEqual(oldAgent.inbox.nextTurn, [])
      assert.deepEqual(oldAgent.inbox.nextStep, [])
      const nativeHistory = oldAgent.session.snapshotEvents()
      const controlHistory = controlAgent.session.snapshotEvents()
      assert.deepEqual(nativeHistory.slice(0, original.events.length), original.events)
      assert.deepEqual(controlHistory.slice(0, controlOriginal.events.length), controlOriginal.events)

      const lifecycleState = await inspectLiveSession(ctx, id)
      assert.deepEqual(lifecycleState, { active: true, canRelease: true, busy: false, reason: undefined })
      const historyPath = ctx.sessionPersistence.locate(original.header).path
      const rawBefore = await readFile(historyPath)
      if (compression === 'zstd') assert.ok(zstdFrameCount(rawBefore) >= 3, 'fixture must have multiple nonempty Native append frames')

      const capturedFollowup = oldAgent.followup
      const capturedSend = oldAgent.send
      const nativeWhenIdle = oldAgent.whenIdle
      let waitEntered
      const entered = new Promise(resolve => { waitEntered = resolve })
      let releaseWait
      const waitGate = new Promise(resolve => { releaseWait = resolve })
      let intercept = true
      oldAgent.whenIdle = function (...args) {
        if (intercept) {
          intercept = false
          waitEntered()
          return waitGate.then(() => {
            delete oldAgent.whenIdle
            return Reflect.apply(nativeWhenIdle, this, args)
          })
        }
        return Reflect.apply(nativeWhenIdle, this, args)
      }

      const releasing = releaseLiveSession(ctx, id)
      try {
        await Promise.race([entered, releasing.then(() => { throw new Error('release completed before the fence observation') })])
        assert.throws(() => capturedFollowup.call(oldAgent, fixtureUser(`${id}-late-followup`)), error => error instanceof LiveSessionError && error.code === 'release-in-progress')
        assert.throws(() => capturedSend.call(oldAgent, fixtureUser(`${id}-late-send`), 'next-turn', true), error => error instanceof LiveSessionError && error.code === 'release-in-progress')
        assert.throws(() => oldAgent.inbox.append('next-turn', fixtureUser(`${id}-direct-inbox`)), error => error instanceof LiveSessionError && error.code === 'release-in-progress')

        const controlEventCount = controlAgent.session.snapshotEvents().length
        controlAgent.inject(fixtureUser(`${controlId}-control-input`))
        assert.equal(controlAgent.session.snapshotEvents().length, controlEventCount + 1, 'the other live Agent still accepts input')
        assert.equal(ctx.agents.get(controlId), controlAgent)
        assert.equal(ctx.sessions.get(controlId), controlAgent.session)
        await assert.rejects(ctx.sessionPersistence.open(controlId, 'write'), 'control Agent must retain its writer lease')
      } finally {
        releaseWait()
      }
      await releasing

      assert.equal(ctx.agents.get(id), undefined)
      assert.equal(ctx.sessions.get(id), undefined)
      assert.equal(ctx.agents.get(controlId), controlAgent)
      assert.equal(ctx.sessions.get(controlId), controlAgent.session)
      await assert.rejects(ctx.sessionPersistence.open(controlId, 'write'), 'releasing the selected Agent must not release another Agent writer')
      assert.throws(() => capturedFollowup.call(oldAgent, fixtureUser(`${id}-stale-followup`)), error => error instanceof LiveSessionError && error.code === 'release-in-progress')
      assert.deepEqual(await readEvents(ctx, id), nativeHistory)
      assert.deepEqual(await readFile(historyPath), rawBefore, 'Native lifecycle release must not rewrite any event bytes')

      const move = await moveSessionWorkspace(migrationContext(ctx), { sessionId: id, workspaceId: targetWorkspace.id })
      assert.equal(move.sessionId, id)
      assert.deepEqual(sourceWorkspace.sessionIds, [controlId])
      assert.deepEqual(targetWorkspace.sessionIds, [id])
      const movedHeader = (await ctx.sessionPersistence.list()).map(row => row.header ?? row).find(row => row.id === id)
      assert.equal(movedHeader.cwd, targetWorkspace.path)
      const movedPath = ctx.sessionPersistence.locate(movedHeader).path
      assert.deepEqual(
        eventBodyBytes(await readFile(movedPath), movedPath),
        eventBodyBytes(rawBefore, historyPath),
        'moving must retain every decoded event row while rewriting only the header row',
      )

      resumedHandle = await ctx.agents.resume({ resumeSessionId: id, agentOptions: { provider: 'fixture', model: 'fixture' } })
      const resumedAgent = resumedHandle.agent
      assert.notEqual(resumedAgent, oldAgent, 'normal resume creates a new Agent instance for the same durable id')
      assert.equal(resumedAgent.id, id)
      assert.equal(resumedAgent.session.header.cwd, targetWorkspace.path)
      assert.deepEqual(resumedAgent.session.snapshotEvents(), nativeHistory)
      resumedAgent.inject(fixtureUser(`${id}-target-append`))
      await ctx.sessions.flush(resumedAgent.session)
      const resumedEvents = await readEvents(ctx, id)
      assert.deepEqual(resumedEvents.slice(0, nativeHistory.length), nativeHistory)
      assert.equal(resumedEvents.at(-1).type, 'agent/inbox/spliced')
      assert.equal(resumedEvents.at(-1).data.inserted[0].id, `${id}-target-append`)
      assert.equal(controlAgent.session.header.cwd, sourcePath)
      await ctx.sessions.flush(controlAgent.session)
      assert.deepEqual((await readEvents(ctx, controlId)).slice(0, controlHistory.length), controlHistory)
    } finally {
      await Promise.resolve(resumedHandle?.dispose()).catch(() => {})
      await Promise.resolve(controlHandle?.dispose()).catch(() => {})
      await Promise.resolve(oldHandle?.dispose()).catch(() => {})
      await ctx?.fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  }
})

test('inspection refuses queued, maintained, unknown, and ambiguous live Agent states without mutation', native, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-live-session-guard-'))
  const cwd = join(root, 'workspace')
  await mkdir(cwd)
  let ctx
  let handle
  let fakeLifecycle
  try {
    const stack = await contextFor(root, 'none')
    ctx = stack.ctx
    const id = 'live-release-guard'
    const original = await seedSession(ctx, stack.Session, stack.SESSION_FORMAT_VERSION, id, cwd)
    await ctx.plugin(stack.WorkspaceRegistry)
    handle = await ctx.agents.resume({ resumeSessionId: id, agentOptions: { provider: 'fixture', model: 'fixture' } })
    const agent = handle.agent

    agent.inject(fixtureUser(`${id}-queued`))
    const queuedBytes = await readFile(ctx.sessionPersistence.locate(original.header).path)
    assert.deepEqual(await inspectLiveSession(ctx, id), { active: true, canRelease: false, busy: true, reason: 'queued-input' })
    await assert.rejects(releaseLiveSession(ctx, id), error => error instanceof LiveSessionError && error.code === 'queued-input')
    assert.deepEqual(await readFile(ctx.sessionPersistence.locate(original.header).path), queuedBytes)
    agent.inbox.clear()

    let finishMaintenance
    const maintenanceGate = new Promise(resolve => { finishMaintenance = resolve })
    const maintenance = agent.runMaintenance(() => maintenanceGate)
    assert.equal(agent.status, 'idle', 'Native status reports maintenance as idle')
    assert.equal(agent.phase.kind, 'maintenance')
    assert.deepEqual(await inspectLiveSession(ctx, id), { active: true, canRelease: false, busy: true, reason: 'agent-busy' })
    const maintenanceBytes = await readFile(ctx.sessionPersistence.locate(original.header).path)
    await assert.rejects(releaseLiveSession(ctx, id), error => error instanceof LiveSessionError && error.code === 'agent-busy')
    assert.deepEqual(await readFile(ctx.sessionPersistence.locate(original.header).path), maintenanceBytes)
    finishMaintenance()
    await maintenance
    const protectedBytes = await readFile(ctx.sessionPersistence.locate(original.header).path)

    const noOwnerContext = {
      agents: ctx.agents,
      sessions: ctx.sessions,
      sessionPersistence: ctx.sessionPersistence,
      root: { registry: { values: function* () {} } },
    }
    assert.deepEqual(await inspectLiveSession(noOwnerContext, id), { active: true, canRelease: false, busy: false, reason: 'unsupported' })
    await assert.rejects(releaseLiveSession(noOwnerContext, id), error => error instanceof LiveSessionError && error.code === 'unsupported')
    assert.deepEqual(await readFile(ctx.sessionPersistence.locate(original.header).path), protectedBytes)

    const effectSymbol = Symbol.for('cordis.effect')
    const scopeMeta = agent.ctx.fiber.dispose[effectSymbol]
    fakeLifecycle = ctx.effect(() => {}, `agentLoop.lifecycle(${id})`)
    fakeLifecycle[effectSymbol].children.push(scopeMeta)
    assert.deepEqual(await inspectLiveSession(ctx, id), { active: true, canRelease: false, busy: false, reason: 'unsupported' })
    await assert.rejects(releaseLiveSession(ctx, id), error => error instanceof LiveSessionError && error.code === 'unsupported')
    assert.deepEqual(await readFile(ctx.sessionPersistence.locate(original.header).path), protectedBytes)
    await fakeLifecycle()
    fakeLifecycle = undefined
    assert.equal(ctx.agents.get(id), agent)
    assert.equal(ctx.sessions.get(id), agent.session)
  } finally {
    await fakeLifecycle?.()
    await Promise.resolve(handle?.dispose()).catch(() => {})
    await ctx?.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test('warm Native workspace move releases only the selected idle Agent and resumes it at the target', native, async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-live-session-warm-move-'))
  const sourcePath = join(root, 'source-workspace')
  const targetPath = join(root, 'target-workspace')
  await mkdir(sourcePath)
  await mkdir(targetPath)
  let ctx
  let liveHandle
  let controlHandle
  let resumedHandle
  try {
    const stack = await contextFor(root, 'zstd')
    ctx = stack.ctx
    const id = 'warm-move-live-session'
    const controlId = 'warm-move-control-session'
    const anchorId = 'warm-move-target-anchor'
    const original = await seedSession(ctx, stack.Session, stack.SESSION_FORMAT_VERSION, id, sourcePath)
    await seedSession(ctx, stack.Session, stack.SESSION_FORMAT_VERSION, controlId, sourcePath)
    await seedSession(ctx, stack.Session, stack.SESSION_FORMAT_VERSION, anchorId, targetPath)
    await ctx.plugin(stack.WorkspaceRegistry)
    const sourceWorkspace = ctx.workspaceRegistry.list().find(workspace => workspace.sessionIds.includes(id))
    const targetWorkspace = ctx.workspaceRegistry.list().find(workspace => workspace.sessionIds.includes(anchorId))
    assert.ok(sourceWorkspace && targetWorkspace && sourceWorkspace !== targetWorkspace)
    assert.deepEqual(new Set(sourceWorkspace.sessionIds), new Set([id, controlId]))
    assert.deepEqual(targetWorkspace.sessionIds, [anchorId])

    liveHandle = await ctx.agents.resume({ resumeSessionId: id, agentOptions: { provider: 'fixture', model: 'fixture' } })
    controlHandle = await ctx.agents.resume({ resumeSessionId: controlId, agentOptions: { provider: 'fixture', model: 'fixture' } })
    const liveAgent = liveHandle.agent
    const controlAgent = controlHandle.agent
    await Promise.all([liveAgent.whenIdle(), controlAgent.whenIdle()])
    const nativeHistory = liveAgent.session.snapshotEvents()
    assert.deepEqual(nativeHistory.slice(0, original.events.length), original.events)
    const sourceArtifact = ctx.sessionPersistence.locate(original.header).path
    const rawBefore = await readFile(sourceArtifact)
    assert.ok(zstdFrameCount(rawBefore) >= 3, 'the warm move fixture must contain multiple nonempty Native zstd frames')

    for (const invalid of [
      { workspaceId: 'missing-target-workspace' },
      { workspaceId: targetWorkspace.id, position: { anchorSessionId: 'not-a-target-member', side: 'before' } },
    ]) {
      await assert.rejects(
        moveSessionWorkspace(ctx, { sessionId: id, ...invalid }),
        error => error?.code === (invalid.workspaceId === targetWorkspace.id ? 'workspace-anchor-not-found' : 'workspace-not-found'),
      )
      assert.equal(ctx.agents.get(id), liveAgent, 'preflight failures must keep the original Agent attached')
      assert.equal(ctx.sessions.get(id), liveAgent.session)
      assert.deepEqual(await readFile(sourceArtifact), rawBefore)
      await assert.rejects(ctx.sessionPersistence.open(controlId, 'write'), 'the control Agent must retain its Native writer')
    }

    const staleFollowup = liveAgent.followup
    const move = await moveSessionWorkspace(ctx, {
      sessionId: id,
      workspaceId: targetWorkspace.id,
      position: { anchorSessionId: anchorId, side: 'before' },
    })
    assert.equal(move.sessionId, id)
    assert.equal(ctx.agents.get(id), undefined)
    assert.equal(ctx.sessions.get(id), undefined)
    assert.deepEqual(sourceWorkspace.sessionIds, [controlId])
    assert.deepEqual(targetWorkspace.sessionIds, [id, anchorId])
    assert.equal(ctx.agents.get(controlId), controlAgent)
    assert.equal(ctx.sessions.get(controlId), controlAgent.session)
    await assert.rejects(ctx.sessionPersistence.open(controlId, 'write'), 'warm move must not release the other Agent writer')
    assert.throws(() => staleFollowup.call(liveAgent, fixtureUser(`${id}-stale-input`)), error => error instanceof LiveSessionError && error.code === 'release-in-progress')

    const movedHeader = (await ctx.sessionPersistence.list()).map(row => row.header ?? row).find(row => row.id === id)
    assert.equal(movedHeader.cwd, targetWorkspace.path)
    const movedArtifact = ctx.sessionPersistence.locate(movedHeader).path
    assert.deepEqual(eventBodyBytes(await readFile(movedArtifact), movedArtifact), eventBodyBytes(rawBefore, sourceArtifact))
    assert.deepEqual(await readEvents(ctx, id), nativeHistory)

    resumedHandle = await ctx.agents.resume({ resumeSessionId: id, agentOptions: { provider: 'fixture', model: 'fixture' } })
    const resumedAgent = resumedHandle.agent
    assert.notEqual(resumedAgent, liveAgent)
    assert.equal(resumedAgent.id, id)
    assert.equal(resumedAgent.session.header.cwd, targetWorkspace.path)
    assert.deepEqual(resumedAgent.session.snapshotEvents(), nativeHistory)
    resumedAgent.inject(fixtureUser(`${id}-target-input`))
    await ctx.sessions.flush(resumedAgent.session)
    const afterAppend = await readEvents(ctx, id)
    assert.deepEqual(afterAppend.slice(0, nativeHistory.length), nativeHistory)
    assert.equal(afterAppend.at(-1).data.inserted[0].id, `${id}-target-input`)
    assert.equal(ctx.agents.get(controlId), controlAgent)
    assert.equal(controlAgent.session.header.cwd, sourcePath)
  } finally {
    await Promise.resolve(resumedHandle?.dispose()).catch(() => {})
    await Promise.resolve(controlHandle?.dispose()).catch(() => {})
    await Promise.resolve(liveHandle?.dispose()).catch(() => {})
    await ctx?.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
})
