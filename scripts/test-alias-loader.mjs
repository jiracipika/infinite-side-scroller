// Custom ESM loader for running TypeScript unit tests with Node's built-in
// test runner. Resolves the at-slash path alias (tsconfig.json paths) to
// ./src/ so test files import source modules the same way app code does.
//
// Requires Node >= 22 (for --experimental-strip-types type erasure).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const local = specifier.slice(2);
    const abs = path.join(ROOT, 'src', local);
    return nextResolve(pathToFileURL(abs + '.ts').href, {
      ...context,
      parentURL: pathToFileURL(ROOT + '/').href,
    });
  }
  return nextResolve(specifier, context);
}
