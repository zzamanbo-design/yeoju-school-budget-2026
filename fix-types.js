const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src/app/api'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const replaced = content.replace(/\.forEach\(\(([a-zA-Z0-9_]+)\) =>/g, '.forEach(($1: any) =>');
  if (replaced !== content) {
    fs.writeFileSync(file, replaced, 'utf8');
    console.log('Fixed', file);
  }
}
