import React from 'react'

// Presentation stays owned by DSH. Unit tests drive the packaged plugin's
// callbacks; the desktop acceptance checks the real primitive's rendering.
export const uiPrimitives = {
  MenuItemButton() {},
  IconFolderOpenOutlineRegular() {},
}

export async function loadClient() {
  let registration
  const previousWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load(value) { registration = value } } }
  try {
    await import('../lib/client.js')
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }

  const externals = []
  const exports = registration.factory((specifier) => {
    externals.push(specifier)
    if (specifier === 'react') return React
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') return uiPrimitives
    throw new Error(`unexpected browser external: ${specifier}`)
  })
  return { registration, exports, externals }
}
