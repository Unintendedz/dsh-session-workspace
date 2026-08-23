import { randomUUID as nodeRandomUUID } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { copyFile, mkdir, open, rename, stat, unlink } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { promisify } from 'node:util'
import { constants as zlibConstants, zstdCompress } from 'node:zlib'

const zstdCompressAsync = promisify(zstdCompress)
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
  await refresh.call(ctx.workspaceRegistry, await ctx.sessionPersistence.list())
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
    if (!ctx.sessionPersistence.supportsRawArtifacts || typeof ctx.sessionPersistence.readRaw !== 'function') {
      fail('unsupported-persistence', 'session workspace moves require per-session JSONL artifacts')
    }

    const workspaces = ctx.workspaceRegistry.list()
    const originalWorkspaceIds = workspaces
      .filter(workspace => workspace.sessionIds.includes(sessionId))
      .map(workspace => workspace.id)
    if (originalWorkspaceIds.includes(target.id)) {
      fail('same-workspace', `session ${JSON.stringify(sessionId)} already belongs to ${JSON.stringify(target.title)}`)
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
