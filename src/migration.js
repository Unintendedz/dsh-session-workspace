import { randomUUID as nodeRandomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { copyFile, link, mkdir, open, readFile, readdir, rename, stat, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import { constants as zlibConstants, zstdCompress, zstdDecompress } from 'node:zlib'

const zstdCompressAsync = promisify(zstdCompress)
const zstdDecompressAsync = promisify(zstdDecompress)
const checksumOptions = {
  params: { [zlibConstants.ZSTD_c_checksumFlag]: 1 },
}
const movingSessions = new Set()

export class WorkspaceMoveError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'WorkspaceMoveError'
    this.code = code
  }
}

function fail(code, message) {
  throw new WorkspaceMoveError(code, message)
}

function newlineAt(content) {
  const at = content.indexOf('\n')
  if (at <= 0) fail('invalid-artifact', 'the session artifact has no complete header line')
  return at
}

export function rewriteRawArtifact(content, targetPath) {
  if (typeof content !== 'string') fail('invalid-artifact', 'the session artifact is not text')
  if (typeof targetPath !== 'string' || !isAbsolute(targetPath)) {
    fail('invalid-workspace-path', 'the target workspace path must be absolute')
  }
  const at = newlineAt(content)
  let meta
  try {
    meta = JSON.parse(content.slice(0, at))
  } catch {
    fail('invalid-artifact', 'the session artifact header is not valid JSON')
  }
  if (meta === null || typeof meta !== 'object' || Array.isArray(meta)
    || meta.type !== 'session' || typeof meta.id !== 'string') {
    fail('invalid-artifact', 'the session artifact has an invalid session header')
  }
  const next = { ...meta, cwd: targetPath }
  return {
    meta: next,
    content: JSON.stringify(next) + content.slice(at),
  }
}

export async function encodeRawArtifact(content, path) {
  if (path.endsWith('.jsonl')) return Buffer.from(content)
  if (!path.endsWith('.jsonl.zstd')) {
    fail('unsupported-persistence', `unsupported session artifact ${JSON.stringify(path)}`)
  }
  const at = newlineAt(content) + 1
  const [header, body] = await Promise.all([
    zstdCompressAsync(content.slice(0, at), checksumOptions),
    zstdCompressAsync(content.slice(at), checksumOptions),
  ])
  return Buffer.concat([header, body])
}

async function pathExists(path) {
  try {
    await stat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function sameRevision(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
}

async function syncedWrite(path, content) {
  const handle = await open(path, 'wx', 0o600)
  try {
    await handle.writeFile(content)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncDirectory(path) {
  if (process.platform === 'win32') return
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function syncFile(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function removeIfPresent(path) {
  try {
    await unlink(path)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

function defaultBackupRoot(source) {
  const sessionRoot = dirname(dirname(dirname(source)))
  return join(dirname(sessionRoot), 'session-workspace-backups')
}

function assertPayload(payload) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('bad-request', 'move payload must be an object')
  }
  const keys = Object.keys(payload)
  if (keys.some(key => key !== 'sessionId' && key !== 'workspaceId')) {
    fail('bad-request', 'move payload contains an unknown field')
  }
  if (typeof payload.sessionId !== 'string' || payload.sessionId.trim() === '') {
    fail('bad-request', 'sessionId must be a non-empty string')
  }
  if (typeof payload.workspaceId !== 'string' || payload.workspaceId.trim() === '') {
    fail('bad-request', 'workspaceId must be a non-empty string')
  }
}

async function refreshWorkspaceHeaders(ctx) {
  const refresh = ctx.workspaceRegistry.replaceHeaderIndex
  if (typeof refresh !== 'function') {
    fail('unsupported-dsh-version', 'this DSH build does not expose the workspace header refresh used by the plugin')
  }
  const snapshots = await ctx.sessionPersistence.list()
  await refresh.call(ctx.workspaceRegistry, snapshots.map(row => row.header ?? row))
}

export function supportsNativeWorkspaceMove(persistence) {
  const format = persistence.generationFormat
  return (format?.currentVersion === 3 && typeof format.createRestore === 'function'
      || format?.currentVersion === 4)
    && typeof persistence.open === 'function'
    && typeof persistence.locate === 'function'
    && typeof persistence.acquireWriteLease === 'function'
}

async function validateCurrentArtifact(persistence, content) {
  const lines = content.trimEnd().split('\n')
  const header = JSON.parse(lines.shift())
  let restore
  if (persistence.generationFormat.currentVersion === 3) {
    restore = persistence.generationFormat.createRestore(header)
  } else {
    // DSH 0.2 keeps the decoder in the first-party catalog, not on persistence.
    const { sessionFormatCatalog } = await import('@deepseek-ai/dsh-session-format-catalog')
    if (sessionFormatCatalog.currentVersion !== 4) {
      fail('unsupported-dsh-version', 'the installed Session catalog does not match the V4 persistence backend')
    }
    restore = sessionFormatCatalog.createRestore(header, { recovery: 'strict', validation: 'current' })
  }
  for (const line of lines) restore.decodeRow(JSON.parse(line))
  restore.finish()
}

async function generationFiles(directory) {
  try {
    return (await readdir(directory)).filter(name => /^session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/.test(name)).sort()
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

async function decodeArtifact(raw, path) {
  if (!path.endsWith('.zstd')) return raw.toString('utf8')
  const chunks = []
  let offset = 0
  while (offset < raw.length) {
    // Node's one-shot decoder stops after one frame; DSH appends many frames.
    const decoded = await zstdDecompressAsync(raw.subarray(offset), { info: true })
    const consumed = decoded.engine.bytesWritten
    if (!Number.isSafeInteger(consumed) || consumed <= 0 || consumed > raw.length - offset) {
      fail('invalid-artifact', 'the compressed session frame did not decode completely')
    }
    chunks.push(decoded.buffer)
    offset += consumed
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** DSH V3/V4 JSONL move, holding native ownership at both physical locations. */
async function moveNativeSession(ctx, sessionId, target, workspaces, originalWorkspaceIds, options) {
  const persistence = ctx.sessionPersistence
  let handle, destinationLease, temporary
  const moved = []
  let destination, published = false, sourceDirectory
  try {
    try {
      handle = await persistence.open(sessionId, 'write')
    } catch (error) {
      if (error?.name === 'SessionAlreadyOwnedError') fail('session-active', error.message)
      throw error
    }
    const header = handle.header
    if (header.id !== sessionId) fail('invalid-artifact', 'the stored session id does not match the requested id')
    const sourceLocation = persistence.locate(header)
    if (sourceLocation?.kind !== 'jsonl' || typeof sourceLocation.path !== 'string') {
      fail('unsupported-persistence', 'session workspace moves require the JSONL persistence backend')
    }
    const source = sourceLocation.path
    sourceDirectory = dirname(source)
    const names = await generationFiles(sourceDirectory)
    const revisions = new Map()
    for (const name of names) revisions.set(name, await stat(join(sourceDirectory, name), { bigint: true }))
    const raw = await readFile(source)
    const content = await decodeArtifact(raw, source)
    const rewritten = rewriteRawArtifact(content, target.path)
    if (rewritten.meta.id !== sessionId || JSON.parse(content.slice(0, newlineAt(content))).cwd !== header.cwd) {
      fail('source-changed', 'the stored header changed while preparing the move')
    }
    // Validate the complete current artifact through the host's own catalog.
    if (!rewritten.content.endsWith('\n')) fail('invalid-artifact', 'the session artifact has an incomplete final line')
    await validateCurrentArtifact(persistence, rewritten.content)
    const destinationLocation = persistence.locate({ ...header, cwd: target.path })
    if (destinationLocation?.kind !== 'jsonl' || typeof destinationLocation.path !== 'string') {
      fail('unsupported-persistence', 'the target session artifact cannot be located')
    }
    destination = destinationLocation.path
    if (source === destination) fail('same-workspace', 'the target workspace resolves to the current session location')
    const assertDestinationEmpty = async () => {
      if ((await generationFiles(dirname(destination))).length > 0) {
        fail('destination-exists', 'refusing to overwrite an existing destination session generation')
      }
    }
    await assertDestinationEmpty()
    destinationLease = await persistence.acquireWriteLease({ ...header, cwd: target.path })
    await assertDestinationEmpty()
    const jobId = (options.randomUUID ?? nodeRandomUUID)()
    const backupDirectory = join(options.backupRoot ?? defaultBackupRoot(source), jobId)
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 })
    for (const name of names) {
      const backup = join(backupDirectory, name)
      await copyFile(join(sourceDirectory, name), backup, fsConstants.COPYFILE_EXCL)
      await syncFile(backup)
    }
    await syncDirectory(backupDirectory)
    await syncDirectory(dirname(backupDirectory))
    await syncDirectory(dirname(dirname(backupDirectory)))
    temporary = join(dirname(destination), `.session-workspace-${jobId}.tmp`)
    await syncedWrite(temporary, await encodeRawArtifact(rewritten.content, destination))
    const currentNames = await generationFiles(sourceDirectory)
    if (JSON.stringify(currentNames) !== JSON.stringify(names)) fail('source-changed', 'session generations changed while preparing the move')
    for (const name of names) {
      if (!sameRevision(revisions.get(name), await stat(join(sourceDirectory, name), { bigint: true }))) {
        fail('source-changed', 'a session generation changed while preparing the move')
      }
    }
    if (ctx.sessions.get(sessionId) !== undefined || ctx.agents.get(sessionId) !== undefined) {
      fail('session-active', 'the session became active while preparing the move')
    }
    try {
      for (const name of names) {
        const original = join(sourceDirectory, name)
        const tombstone = join(sourceDirectory, `.dsh-moving-${jobId}-${name}`)
        await rename(original, tombstone)
        moved.push({ original, tombstone })
      }
      // link() refuses a concurrent destination instead of replacing it.
      await link(temporary, destination)
      published = true
      await removeIfPresent(temporary)
      temporary = undefined
      await syncDirectory(sourceDirectory)
      await syncDirectory(dirname(destination))
      await refreshWorkspaceHeaders(ctx)
      for (const workspace of workspaces) {
        if (workspace.id !== target.id) await workspace.detachSession(sessionId)
      }
      await target.attachSession(sessionId)
    } catch (error) {
      const failures = [error]
      try {
        if (published) await removeIfPresent(destination)
        for (const item of moved.toReversed()) await rename(item.tombstone, item.original)
        await syncDirectory(sourceDirectory)
        await syncDirectory(dirname(destination))
      } catch (rollbackError) { failures.push(rollbackError) }
      try {
        await refreshWorkspaceHeaders(ctx)
        await restoreWorkspaceAccounts(ctx, sessionId, originalWorkspaceIds)
      } catch (rollbackError) { failures.push(rollbackError) }
      if (failures.length > 1) throw new AggregateError(failures, `session move failed and rollback was incomplete: ${String(error)}`)
      throw error
    }
    for (const item of moved) await removeIfPresent(item.tombstone)
    await syncDirectory(sourceDirectory)
    return { sessionId, workspaceId: target.id, path: target.path, backupPath: join(backupDirectory, basename(source)) }
  } finally {
    try {
      if (temporary !== undefined) await removeIfPresent(temporary)
    } finally {
      try { await handle?.close() } finally { await destinationLease?.release() }
    }
  }
}

async function restoreWorkspaceAccounts(ctx, sessionId, originalWorkspaceIds) {
  const original = new Set(originalWorkspaceIds)
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (!original.has(workspace.id)) await workspace.detachSession(sessionId)
  }
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (original.has(workspace.id)) await workspace.attachSession(sessionId)
  }
}

async function rollbackPhysicalMove({ source, destination, tombstone, rollbackFile }) {
  if (await pathExists(destination)) await rename(destination, rollbackFile)
  if (await pathExists(tombstone)) await rename(tombstone, source)
  await removeIfPresent(rollbackFile)
  await syncDirectory(dirname(source))
  await syncDirectory(dirname(destination))
}

export async function moveSessionWorkspace(ctx, payload, options = {}) {
  assertPayload(payload)
  const { sessionId, workspaceId } = payload
  if (movingSessions.has(sessionId)) fail('move-in-progress', `session ${JSON.stringify(sessionId)} is already moving`)
  movingSessions.add(sessionId)

  let temporary
  try {
    if (ctx.sessions.get(sessionId) !== undefined || ctx.agents.get(sessionId) !== undefined) {
      fail('session-active', `session ${JSON.stringify(sessionId)} is active; close it before moving it`)
    }
    const target = ctx.workspaceRegistry.get(workspaceId)
    if (target === undefined) fail('workspace-not-found', `workspace ${JSON.stringify(workspaceId)} was not found`)
    if (typeof ctx.workspaceRegistry.replaceHeaderIndex !== 'function') {
      fail('unsupported-dsh-version', 'this DSH build does not expose the workspace header refresh used by the plugin')
    }
    const workspaces = ctx.workspaceRegistry.list()
    const originalWorkspaceIds = workspaces
      .filter(workspace => workspace.sessionIds.includes(sessionId))
      .map(workspace => workspace.id)
    if (originalWorkspaceIds.includes(target.id)) {
      fail('same-workspace', `session ${JSON.stringify(sessionId)} already belongs to ${JSON.stringify(target.title)}`)
    }

    if (supportsNativeWorkspaceMove(ctx.sessionPersistence)) {
      return await moveNativeSession(ctx, sessionId, target, workspaces, originalWorkspaceIds, options)
    }
    if (!ctx.sessionPersistence.supportsRawArtifacts || typeof ctx.sessionPersistence.readRaw !== 'function') {
      fail('unsupported-persistence', 'session workspace moves require per-session JSONL artifacts')
    }

    const inspection = await ctx.sessionPersistence.load(sessionId)
    if (inspection.meta.id !== sessionId) fail('invalid-artifact', 'the stored session id does not match the requested id')
    const sourceLocation = ctx.sessionPersistence.locate(inspection.meta)
    if (sourceLocation?.kind !== 'jsonl' || typeof sourceLocation.path !== 'string') {
      fail('unsupported-persistence', 'session workspace moves require the JSONL persistence backend')
    }
    const source = sourceLocation.path
    const before = await stat(source, { bigint: true })
    const artifact = await ctx.sessionPersistence.readRaw(sessionId)
    if (artifact === undefined) fail('session-not-found', `session ${JSON.stringify(sessionId)} was not found`)
    if (artifact.meta.id !== sessionId || artifact.meta.cwd !== inspection.meta.cwd) {
      fail('source-changed', `session ${JSON.stringify(sessionId)} changed while its snapshot was read`)
    }
    const afterRead = await stat(source, { bigint: true })
    if (!sameRevision(before, afterRead)) {
      fail('source-changed', `session ${JSON.stringify(sessionId)} changed while its snapshot was read`)
    }

    const rewritten = rewriteRawArtifact(artifact.content, target.path)
    const destinationLocation = ctx.sessionPersistence.locate(rewritten.meta)
    if (destinationLocation?.kind !== 'jsonl' || typeof destinationLocation.path !== 'string') {
      fail('unsupported-persistence', 'the target session artifact cannot be located')
    }
    const destination = destinationLocation.path
    if (source === destination) fail('same-workspace', 'the target workspace resolves to the current session location')
    if (await pathExists(destination)) {
      fail('destination-exists', `refusing to overwrite existing artifact ${JSON.stringify(destination)}`)
    }

    const encoded = await encodeRawArtifact(rewritten.content, destination)
    const jobId = (options.randomUUID ?? nodeRandomUUID)()
    const backupRoot = options.backupRoot ?? defaultBackupRoot(source)
    const backupDirectory = join(backupRoot, jobId)
    const backupPath = join(backupDirectory, destination.endsWith('.zstd') ? 'session.jsonl.zstd' : 'session.jsonl')
    await mkdir(backupDirectory, { recursive: true, mode: 0o700 })
    await copyFile(source, backupPath, fsConstants.COPYFILE_EXCL)
    await syncFile(backupPath)
    await syncDirectory(backupDirectory)
    await syncDirectory(dirname(backupDirectory))
    await syncDirectory(dirname(dirname(backupDirectory)))

    await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
    temporary = join(dirname(destination), `.session-workspace-${jobId}.tmp`)
    await syncedWrite(temporary, encoded)
    const afterBackup = await stat(source, { bigint: true })
    if (!sameRevision(before, afterBackup)) {
      fail('source-changed', `session ${JSON.stringify(sessionId)} changed while its move was prepared`)
    }
    if (ctx.sessions.get(sessionId) !== undefined || ctx.agents.get(sessionId) !== undefined) {
      fail('session-active', `session ${JSON.stringify(sessionId)} became active while its move was prepared`)
    }

    const tombstone = `${source}.moving-${jobId}`
    const rollbackFile = `${destination}.rollback-${jobId}`
    await rename(source, tombstone)
    try {
      await rename(temporary, destination)
      temporary = undefined
      await syncDirectory(dirname(source))
      await syncDirectory(dirname(destination))
    } catch (error) {
      await rename(tombstone, source)
      throw error
    }

    try {
      await refreshWorkspaceHeaders(ctx)
      for (const workspace of workspaces) {
        if (workspace.id !== target.id) await workspace.detachSession(sessionId)
      }
      await target.attachSession(sessionId)
    } catch (error) {
      const rollbackErrors = []
      try {
        await rollbackPhysicalMove({ source, destination, tombstone, rollbackFile })
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      try {
        await refreshWorkspaceHeaders(ctx)
        await restoreWorkspaceAccounts(ctx, sessionId, originalWorkspaceIds)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
      if (rollbackErrors.length > 0) {
        throw new AggregateError([error, ...rollbackErrors], `session move failed and rollback was incomplete: ${String(error)}`)
      }
      throw error
    }

    await removeIfPresent(tombstone)
    await syncDirectory(dirname(source))
    return { sessionId, workspaceId, path: target.path, backupPath }
  } finally {
    if (temporary !== undefined) await removeIfPresent(temporary)
    movingSessions.delete(sessionId)
  }
}
