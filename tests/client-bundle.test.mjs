import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadClient } from './client-harness.mjs'

test('published browser entry registers its factory with the DSH ModuleLoader', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.exports['./client'], './lib/client.js')
  const { registration, exports, externals } = await loadClient()
  assert.ok(registration, 'published client entry must register through window.__ModuleLoader__.load')
  assert.equal(registration.id, 'dsh-session-workspace')
  assert.equal(typeof exports.apply, 'function')
  assert.deepEqual(Array.from(exports.inject), ['locale', 'connection', 'slots', 'sessions', 'workspaces', 'uiWorkspace'])
  assert.deepEqual(externals, ['react', '@deepseek-ai/dsh-client-ui-primitives'])
})
