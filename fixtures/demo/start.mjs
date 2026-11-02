import { createDemoServer } from './server.mjs';

createDemoServer().listen(3001, '127.0.0.1', () => {
  console.log('GhostQA demo fixture listening at http://127.0.0.1:3001');
});
