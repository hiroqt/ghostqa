import { createServer } from 'node:http';

const headers = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

function page(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><main>${content}</main></body></html>`;
}

export function createDemoServer() {
  return createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    let status = 200;
    let body;

    if (request.method === 'GET' && path === '/') {
      body = page('GhostQA demo', '<h1>GhostQA demo</h1><a href="/register">Register</a> <a href="/health">Health</a>');
    } else if (request.method === 'GET' && path === '/register') {
      body = page('Register', '<h1>Register</h1><form action="/register" method="post"><label for="email">Email</label><input id="email" name="email" type="email" required><label for="password">Password</label><input id="password" name="password" type="password" required><button type="submit">Create account</button></form>');
    } else if (request.method === 'POST' && path === '/register') {
      request.resume();
      status = 500;
      body = page('Registration failed', '<h1>Registration failed</h1><p>Unable to create account.</p>');
    } else if (request.method === 'GET' && path === '/health') {
      body = page('Demo is ready', '<h1>Demo is ready</h1>');
    } else {
      status = 404;
      body = page('Not found', '<h1>Not found</h1>');
    }

    response.writeHead(status, headers);
    response.end(body);
  });
}
