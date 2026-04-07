import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.cwd(), 'data', 'jlpt.db'));
const points = db.prepare('SELECT id, title, examples FROM grammar_points').all() as any[];

let total = 0, hasCloze = 0, noCloze = 0;
const broken: string[] = [];

for (const p of points) {
  const ex = JSON.parse(p.examples);
  if (!ex.length) continue;
  total++;
  const first = ex[0];
  if (first.jaPrompt && first.clozeAnswer) {
    const reconstructed = first.jaPrompt.replace('___', first.clozeAnswer);
    if (reconstructed === first.ja) {
      hasCloze++;
    } else {
      noCloze++;
      broken.push('MISMATCH: ' + p.title);
    }
  } else {
    noCloze++;
    broken.push('MISSING: ' + p.title);
  }
}

console.log('Total:', total);
console.log('Has valid cloze:', hasCloze);
console.log('Missing/broken:', noCloze);
console.log('Coverage:', ((hasCloze / total) * 100).toFixed(1) + '%');
if (broken.length > 0) {
  console.log('\nBroken items:');
  broken.forEach(b => console.log('  ' + b));
}
