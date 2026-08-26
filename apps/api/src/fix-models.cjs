const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('C:\\Users\\lenovo\\Documents\\GitHub\\HMS\\apps\\api\\src', function(filePath) {
  if (filePath.endsWith('.model.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content.replace(/transform:\s*\(\_,\s*ret:\s*any\)\s*=>/g, 'transform: (_, ret: Record<string, unknown>) =>');
    content = content.replace(/transform:\s*\(\_:\s*any,\s*ret:\s*any\)\s*=>/g, 'transform: (_, ret: Record<string, unknown>) =>');
    content = content.replace(/transform:\s*\(\_,\s*ret\)\s*=>/g, 'transform: (_, ret: Record<string, unknown>) =>');

    content = content.replace(/delete\s+\(ret as any\)\._id;/g, 'delete ret._id;');
    content = content.replace(/delete\s+\(ret as any\)\.__v;/g, 'delete ret.__v;');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
