// Prepends `'use client';` to dist/supabase/client.{js,cjs} after tsup runs.
// tsup's banner + esbuild directive preservation don't cooperate reliably for
// single-entry directives, so we inject deterministically after the build.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const targets = [
  resolve(here, '..', 'dist', 'supabase', 'client.js'),
  resolve(here, '..', 'dist', 'supabase', 'client.cjs'),
]

const directive = "'use client';\n"

for (const file of targets) {
  if (!existsSync(file)) {
    console.warn(`[add-use-client] skip (missing): ${file}`)
    continue
  }
  const contents = readFileSync(file, 'utf8')
  if (contents.startsWith("'use client'") || contents.startsWith('"use client"')) {
    continue
  }
  writeFileSync(file, directive + contents)
  console.log(`[add-use-client] prepended 'use client' → ${file}`)
}
