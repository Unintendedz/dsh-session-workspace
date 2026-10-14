import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

// A versioned, self-contained Host URL avoids DSH 0.2's process-wide ESM cache.
await build({
  entryPoints: ['src/index.js'],
  outfile: `lib/host-${packageJson.version}.mjs`,
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  bundle: true,
  packages: 'external',
  format: 'esm',
  platform: 'node',
  target: 'es2022',
  legalComments: 'none',
})

await build({
  entryPoints: ['src/client.js'],
  outfile: 'lib/client.js',
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  bundle: true,
  external: ['react'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  legalComments: 'none',
  banner: {
    js: 'window.__ModuleLoader__.load({id:"dsh-session-workspace",factory:(require)=>{var module={exports:{}};var exports=module.exports;',
  },
  footer: {
    js: 'return module.exports;}});',
  },
})
