// Custom ESM loader for running TypeScript unit tests with Node's built-in
// test runner. Resolves the at-slash path alias (tsconfig.json paths) to
// ./src/ so test files import source modules the same way app code does.
//
// Also resolves extensionless relative imports (e.g. `./sfx` → `./sfx.ts`)
// so multi-file barrel exports work under Node's type-stripping mode.
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

  // Resolve extensionless relative imports (./foo or ../foo) to ./foo.ts
  // so barrel files importing sibling modules work under type stripping.
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !path.extname(specifier)
  ) {
    const parentDir = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : ROOT;
    const abs = path.resolve(parentDir, specifier + '.ts');
    return nextResolve(pathToFileURL(abs).href, context);
  }

  return nextResolve(specifier, context);
}
