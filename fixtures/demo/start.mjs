import { createDemoServer } from './server.mjs';

const port = Number(process.env.GHOSTQA_FIXTURE_PORT ?? 3001);
createDemoServer().listen(port, '127.0.0.1', () => {
  console.log(`GhostQA demo fixture listening at http://127.0.0.1:${port}`);
});
