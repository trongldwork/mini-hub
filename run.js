import { spawn } from 'child_process';

console.log('Starting backend server and frontend Vite dev server concurrently...\n');

// Spawn the backend server
const server = spawn('npm', ['run', 'server'], {
  stdio: 'inherit',
  shell: true,
});

// Spawn the Vite development server
const client = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

const shutdown = () => {
  console.log('\nShutting down servers...');
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
