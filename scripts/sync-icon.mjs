import { readFile, writeFile } from 'node:fs/promises';

const manifestUrl = new URL('../package.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
const icon = await readFile(new URL('../assets/zenmux.svg', import.meta.url));

manifest.magpie.icon = `data:image/svg+xml;base64,${icon.toString('base64')}`;

await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
