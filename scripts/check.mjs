import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['index.mjs'];

for (const directory of ['src', 'scripts']) {
  const entries = await readdir(new URL(`../${directory}/`, import.meta.url), { recursive: true });
  files.push(
    ...entries.filter((entry) => entry.endsWith('.mjs')).map((entry) => `${directory}/${entry}`),
  );
}

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
