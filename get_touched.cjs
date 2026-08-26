const fs = require('fs');
const log = fs.readFileSync('C:/Users/lenovo/.gemini/antigravity/brain/f2a36133-3b42-4ad4-9c04-a40396696e70/.system_generated/logs/transcript.jsonl', 'utf8');
const files = new Set();
for (const line of log.split('\n')) {
  if (line.includes('TargetFile')) {
    const match = line.match(/"TargetFile":"\\"([^"]+)\\""/);
    if (match) {
        let f = match[1].replace(/\\\\\\\\/g, '/');
        files.add(f);
    }
  }
}
console.log(Array.from(files).filter(f => f.includes('apps/api') || f.includes('apps/web')).join('\n'));
