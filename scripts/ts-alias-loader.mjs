// Minimal ESM loader so a plain Node script can import the app's TypeScript
// modules the way the bundler does: `@/x` -> <repo>/src/x, and extensionless
// relative imports get `.ts` / `.tsx`. Used only by the layout verification
// script; Node's built-in type stripping handles the rest.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = new URL('../src/', import.meta.url);

function addExtension(url) {
  const href = typeof url === 'string' ? url : url.href;
  if (!href.startsWith('file:')) return href;
  const file = fileURLToPath(href);
  for (const ext of ['.ts', '.tsx', '.mts', '.js', '/index.ts', '/index.tsx']) {
    if (existsSync(file + ext)) return pathToFileURL(file + ext).href;
  }
  return href;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    return { url: addExtension(new URL(specifier.slice(2), SRC)), shortCircuit: true };
  }
  if (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/')) {
    const resolved = new URL(specifier, context.parentURL);
    return { url: addExtension(resolved), shortCircuit: true };
  }
  return next(specifier, context);
}
