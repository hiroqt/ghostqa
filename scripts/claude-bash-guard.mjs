// Conservative Claude Code hook: block common destructive shell commands.
// Hook format/behavior must be validated against installed Claude Code version.
let raw='';process.stdin.setEncoding('utf8');for await (const c of process.stdin) raw+=c;
let data={};try{data=JSON.parse(raw)}catch{process.exit(0)}
const cmd=String(data.tool_input?.command||'');
const patterns=[/\brm\s+-rf\b/i,/\bgit\s+push\s+--force\b/i,/\bgit\s+reset\s+--hard\b/i,/\bcurl\b[^\n]*\|\s*(bash|sh)\b/i];
if(patterns.some(p=>p.test(cmd))){console.error('GhostQA hook: blocked destructive shell command');process.exit(2)}
