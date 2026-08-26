const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('C:\\Users\\lenovo\\Documents\\GitHub\\HMS\\apps\\api\\src\\modules', function(filePath) {
  if (filePath.endsWith('.repository.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // auth.repository.ts
    content = content.replace('const mapUser = (user: any): AuthUserRecord => ({', 'const mapUser = (user: Record<string, unknown>): AuthUserRecord => ({');
    content = content.replace("user.status = 'locked' as any;", "user.status = 'locked';"); // assuming 'locked' is valid or we should cast differently. Let's look at user.model.ts
    content = content.replace('revokedAt: (token as any).revokedAt ?? null,', 'revokedAt: (token as Record<string, unknown>).revokedAt ?? null,');
    content = content.replace('replacedByTokenId: (token as any).replacedByTokenId ?? null,', 'replacedByTokenId: (token as Record<string, unknown>).replacedByTokenId ?? null,');
    
    // branch.repository.ts
    content = content.replace('const filter: any = { deletedAt: null };', "import type { FilterQuery, UpdateQuery } from 'mongoose';\n    const filter: FilterQuery<any> = { deletedAt: null };"); 
    // wait I need actual type. Let's do it file by file manually if needed, or use a script with specific replaces.
  }
});
