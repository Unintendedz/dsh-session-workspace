import assert from 'node:assert/strict'
import { zstdDecompressSync } from 'node:zlib'
import { access, appendFile, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  encodeRawArtifact,
  moveSessionWorkspace,
  rewriteRawArtifact,
} from '../src/migration.js'

const SESSION_ID = 'session-test'
const OLD_PATH = '/projects/old'
const NEW_PATH = '/projects/new'

function rawSession(cwd = OLD_PATH) {
  return [
    JSON.stringify({ type: 'session', version: 0, id: SESSION_ID, createdAt: 42, cwd, delegationDepth: 0 }),
    JSON.stringify({ type: 'user/message', seq: 0, time: 43, data: { role: 'user', content: [{ type: 'text', text: 'keep me byte-for-byte' }] }, surfaceOp: 'append' }),
    JSON.stringify({ type: 'text-chunks', seq0: 1, time0: 44, data: { block: 0, deltas: ['a', 'b', 'c'], dts: [0, 1, 1] } }),
    '',
  ].join('\n')
}

function secondZstdFrame(buffer) {
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const offset = buffer.indexOf(magic, 4)
  assert.notEqual(offset, -1, 'artifact must contain a separate body frame')
  return offset
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function fixture({ active = false, changeDuringRead = false, destinationExists = false, failTargetAttach = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-session-workspace-'))
  const source = join(root, 'sessions', 'old-project', SESSION_ID, 'session.jsonl')
  const destination = join(root, 'sessions', 'new-project', SESSION_ID, 'session.jsonl')
  const backupRoot = join(root, 'backups')
  await mkdir(join(source, '..'), { recursive: true })
  await writeFile(source, rawSession(), { mode: 0o600 })
  if (destinationExists) {
    await mkdir(join(destination, '..'), { recursive: true })
    await writeFile(destination, 'occupied\n', { mode: 0o600 })
  }

  const locations = new Map([[OLD_PATH, source], [NEW_PATH, destination]])
  const persistence = {
    supportsRawArtifacts: true,
    locate(meta) {
      return { kind: 'jsonl', path: locations.get(meta.cwd) }
    },
    async load(id) {
      assert.equal(id, SESSION_ID)
      return { meta: { id, cwd: OLD_PATH }, events: [] }
    },
    async readRaw(id) {
      assert.equal(id, SESSION_ID)
      const path = await exists(source) ? source : destination
      const content = await readFile(path, 'utf8')
      if (changeDuringRead && path === source) await appendFile(source, '{"type":"late-write"}\n')
      const meta = JSON.parse(content.slice(0, content.indexOf('\n')))
      return { meta, filename: 'session', content }
    },
    async list() {
      const path = await exists(destination) ? destination : source
      const content = await readFile(path, 'utf8')
      return [JSON.parse(content.slice(0, content.indexOf('\n')))]
    },
  }

  const headers = new Map([[SESSION_ID, { id: SESSION_ID, cwd: OLD_PATH }]])
  const registry = {
    headers,
    workspaces: [],
    list() { return this.workspaces },
    get(id) { return this.workspaces.find(workspace => workspace.id === id) },
    async replaceHeaderIndex(next) {
      headers.clear()
      for (const header of next) headers.set(header.id, header)
    },
  }
  function workspace(id, path, ids, failAttach = false) {
    const account = [...ids]
    return {
      id,
      path,
      title: id,
      get sessionIds() {
        return account.filter(sessionId => headers.get(sessionId)?.cwd === path)
      },
      async attachSession(sessionId) {
        if (failAttach) throw new Error('target write failed')
        const header = headers.get(sessionId)
        if (header?.cwd !== path) throw new Error(`header cwd ${header?.cwd} does not match ${path}`)
        if (!account.includes(sessionId)) account.unshift(sessionId)
      },
      async detachSession(sessionId) {
        const index = account.indexOf(sessionId)
        if (index !== -1) account.splice(index, 1)
      },
    }
  }
  const oldWorkspace = workspace('old-workspace', OLD_PATH, [SESSION_ID])
  const newWorkspace = workspace('new-workspace', NEW_PATH, [], failTargetAttach)
  registry.workspaces.push(oldWorkspace, newWorkspace)

  return {
    source,
    destination,
    backupRoot,
    oldWorkspace,
    newWorkspace,
    ctx: {
      sessions: { get: () => active ? { id: SESSION_ID } : undefined },
      agents: { get: () => undefined },
      sessionPersistence: persistence,
      workspaceRegistry: registry,
    },
  }
}

test('rewriteRawArtifact changes only the session header cwd', () => {
  const original = rawSession()
  const rewritten = rewriteRawArtifact(original, NEW_PATH)
  assert.deepEqual(rewritten.meta, {
    type: 'session', version: 0, id: SESSION_ID, createdAt: 42, cwd: NEW_PATH, delegationDepth: 0,
  })
  assert.equal(rewritten.content.slice(rewritten.content.indexOf('\n')), original.slice(original.indexOf('\n')))
})

test('encodeRawArtifact emits separate checksummed zstd header and body frames', async () => {
  const content = rewriteRawArtifact(rawSession(), NEW_PATH).content
  const encoded = await encodeRawArtifact(content, '/tmp/session.jsonl.zstd')
  const bodyAt = secondZstdFrame(encoded)
  const header = zstdDecompressSync(encoded.subarray(0, bodyAt)).toString()
  const body = zstdDecompressSync(encoded.subarray(bodyAt)).toString()
  assert.equal(header, content.slice(0, content.indexOf('\n') + 1))
  assert.equal(body, content.slice(content.indexOf('\n') + 1))
  assert.equal(encoded[4] & 0x04, 0x04, 'header frame must carry a checksum')
  assert.equal(encoded[bodyAt + 4] & 0x04, 0x04, 'body frame must carry a checksum')
})

test('moveSessionWorkspace atomically moves a cold session and keeps a backup', async () => {
  const f = await fixture()
  const original = await readFile(f.source, 'utf8')

  const result = await moveSessionWorkspace(f.ctx, {
    sessionId: SESSION_ID,
    workspaceId: 'new-workspace',
  }, {
    backupRoot: f.backupRoot,
    now: () => new Date('2026-08-23T00:00:00.000Z'),
    randomUUID: () => 'backup-id',
  })

  assert.equal(await exists(f.source), false)
  assert.equal(await exists(f.destination), true)
  const moved = await readFile(f.destination, 'utf8')
  assert.equal(JSON.parse(moved.slice(0, moved.indexOf('\n'))).cwd, NEW_PATH)
  assert.equal(moved.slice(moved.indexOf('\n')), original.slice(original.indexOf('\n')))
  assert.deepEqual(f.oldWorkspace.sessionIds, [])
  assert.deepEqual(f.newWorkspace.sessionIds, [SESSION_ID])
  assert.equal(await readFile(result.backupPath, 'utf8'), original)
  assert.deepEqual(result, {
    sessionId: SESSION_ID,
    workspaceId: 'new-workspace',
    path: NEW_PATH,
    backupPath: join(f.backupRoot, 'backup-id', 'session.jsonl'),
  })
})

test('moveSessionWorkspace refuses a live session without touching its artifact', async () => {
  const f = await fixture({ active: true })
  const before = await stat(f.source)
  await assert.rejects(
    moveSessionWorkspace(f.ctx, { sessionId: SESSION_ID, workspaceId: 'new-workspace' }, { backupRoot: f.backupRoot }),
    error => error.code === 'session-active',
  )
  const after = await stat(f.source)
  assert.equal(after.ino, before.ino)
  assert.equal(await exists(f.destination), false)
})

test('moveSessionWorkspace refuses an occupied destination without touching the source', async () => {
  const f = await fixture({ destinationExists: true })
  const original = await readFile(f.source, 'utf8')
  await assert.rejects(
    moveSessionWorkspace(f.ctx, { sessionId: SESSION_ID, workspaceId: 'new-workspace' }, { backupRoot: f.backupRoot }),
    error => error.code === 'destination-exists',
  )
  assert.equal(await readFile(f.source, 'utf8'), original)
  assert.equal(await readFile(f.destination, 'utf8'), 'occupied\n')
})

test('moveSessionWorkspace refuses a source that changes while its snapshot is read', async () => {
  const f = await fixture({ changeDuringRead: true })
  await assert.rejects(
    moveSessionWorkspace(f.ctx, { sessionId: SESSION_ID, workspaceId: 'new-workspace' }, { backupRoot: f.backupRoot }),
    error => error.code === 'source-changed',
  )
  assert.match(await readFile(f.source, 'utf8'), /late-write/)
  assert.equal(await exists(f.destination), false)
  assert.deepEqual(f.oldWorkspace.sessionIds, [SESSION_ID])
})

test('moveSessionWorkspace restores the artifact and account when workspace attach fails', async () => {
  const f = await fixture({ failTargetAttach: true })
  const original = await readFile(f.source, 'utf8')
  await assert.rejects(
    moveSessionWorkspace(f.ctx, { sessionId: SESSION_ID, workspaceId: 'new-workspace' }, { backupRoot: f.backupRoot }),
    /target write failed/,
  )
  assert.equal(await readFile(f.source, 'utf8'), original)
  assert.equal(await exists(f.destination), false)
  assert.deepEqual(f.oldWorkspace.sessionIds, [SESSION_ID])
  assert.deepEqual(f.newWorkspace.sessionIds, [])
})
