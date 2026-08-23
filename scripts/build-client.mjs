import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

await build({
  entryPoints: ['src/client.js'],
  outfile: 'lib/client.js',
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  bundle: true,
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
