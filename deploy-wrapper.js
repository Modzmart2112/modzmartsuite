
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Node version:', process.version);
console.log('Starting application in production mode...');

// Start the application and keep it running
const childProcess = spawn('node', ['--enable-source-maps', 'dist/index.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

childProcess.on('error', (error) => {
  console.error('Failed to start child process:', error);
  process.exit(1);
});

// Keep the parent process running until child exits
childProcess.on('exit', (code) => {
  console.log(`Child process exited with code ${code}`);
  process.exit(code);
});
