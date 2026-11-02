import { execFileSync } from 'node:child_process';
const forbidden = [/^\.env($|\.)/, /^node_modules\//, /^\.next\//, /(^|\/)\.DS_Store$/];
const files = execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).split('\n').filter(Boolean);
const bad = files.filter(p => forbidden.some(re=>re.test(p)) && p !== '.env.example');
if (bad.length) { console.error('Blocked staged secret/build files:',bad.join(', ')); process.exit(1); }
console.log('Staged file scope guard passed');
