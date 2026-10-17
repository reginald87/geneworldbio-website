import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const server = spawn(process.execPath, ['--watch', 'server/index.js'], { cwd: rootPath, stdio: 'inherit', env: process.env });
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: rootPath, stdio: 'inherit', env: process.env });
for (const child of [server, vite]) child.on('exit', code => { if (code && code !== 0) process.exitCode = code; });
function stop() { server.kill(); vite.kill(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
