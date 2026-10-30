import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { build } from 'esbuild';

/** Build old and new renderers against the same fixture, without worktrees,
 * running servers, dependency changes or changes to either checkout. */
export async function rendererHarness(root, reference) {
  const sha = reference ? execFileSync('git', ['rev-parse', '--verify', `${reference}^{commit}`], { cwd: root, encoding: 'utf8' }).trim() : null;
  const result = await build({ stdin: { contents: `
import {GameEngine} from './src/game/engine/game-engine';
import {Onyx} from './src/game/entities/Onyx';
import {Mortimer} from './src/game/entities/Mortimer';
import {Grimshaw} from './src/game/entities/Grimshaw';
import {Dorian} from './src/game/entities/Dorian';
import {CHARACTERS} from './src/game/data/characters';
import {drawCharacterArt} from './src/game/rendering/character-art';
import {ensureCharacterFullArtLoading,characterFullArtReady} from './src/game/rendering/character-fullart';
${sha ? '' : "import {fullArtCacheStats} from './src/game/rendering/fullart-mesh';"}
window.renderBenchmark={GameEngine,Onyx,Mortimer,Grimshaw,Dorian,CHARACTERS,drawCharacterArt,
ensureCharacterFullArtLoading,characterFullArtReady,cacheStats:${sha ? 'null' : 'fullArtCacheStats'}};
`, resolveDir: root }, bundle: true, format: 'iife', write: false,
    plugins: sha ? [{ name: 'reference-source', setup(builder) {
      builder.onLoad({ filter: /\/src\/.*\.tsx?$/ }, ({ path: file }) => ({
        contents: execFileSync('git', ['show', `${sha}:${path.relative(root, file).split(path.sep).join('/')}`], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }),
        loader: file.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: path.dirname(file),
      }));
    } }] : [],
  });
  return { sha, code: result.outputFiles[0].text };
}
