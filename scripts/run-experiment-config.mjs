import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const configPath = path.join(repoRoot, 'config', 'experiment-defaults.json');

function main() {
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  console.log(JSON.stringify({
    message: 'Experiment config loaded',
    configPath,
    config,
  }, null, 2));
}

main();
