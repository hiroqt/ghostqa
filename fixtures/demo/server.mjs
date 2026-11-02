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
    } else if (request.method === 'GET' && path === '/slop') {
      body = page('Design review fixture', '<link rel="stylesheet" href="/slop.css"><h1>One dashboard for everything</h1><div class="card">Automate anything</div><div class="card">Unlock insights</div><div class="card">Get started today</div><a href="#">Get started</a><script src="/slop.js"></script>');
    } else if (request.method === 'GET' && path === '/slop.css') {
      body = 'body { background: linear-gradient(90deg, #6742c7, #3155ff); font-family: sans-serif; } .card { backdrop-filter: blur(12px); border-radius: 32px; box-shadow: 0 20px 40px #0003; padding: 20px; background: #fffc; } h1 { color: white !important; margin: 12px !important; padding: 12px !important; }';
    } else if (request.method === 'GET' && path === '/slop.js') {
      body = "console.log('fixture'); // TODO: wire up call to action";
    } else {
      status = 404;
      body = page('Not found', '<h1>Not found</h1>');
    }

    response.writeHead(status, path === '/slop' ? { ...headers, 'content-security-policy': "default-src 'none'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'" }
      : path === '/slop.css' ? { ...headers, 'content-type': 'text/css; charset=utf-8' }
        : path === '/slop.js' ? { ...headers, 'content-type': 'text/javascript; charset=utf-8' } : headers);
    response.end(body);
  });
}
