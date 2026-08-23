import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('published browser entry registers its factory with the DSH ModuleLoader', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const clientUrl = new URL(manifest.exports['./client'], new URL('../', import.meta.url))
  let handoff
  const previousWindow = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load(registration) { handoff = registration },
    },
  }

  try {
    await import(`${clientUrl.href}?loader-contract`)
    assert.ok(handoff, 'published client entry must register through window.__ModuleLoader__.load')
    assert.equal(handoff.id, 'dsh-session-workspace')
    const exports = handoff.factory((specifier) => {
      throw new Error(`unexpected browser external: ${specifier}`)
    })
    assert.equal(typeof exports.apply, 'function')
    assert.deepEqual(Array.from(exports.inject), ['locale', 'connection'])
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
