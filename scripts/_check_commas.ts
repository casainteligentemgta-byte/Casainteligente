import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');
const csvPath = path.join(root, 'tmp', 'RANCHO_20072026.csv');
const csvText = fs.readFileSync(csvPath, 'utf8');

const lines = csvText.split('\n');
let commaNumbers = 0;
for (const line of lines.slice(1)) {
  const cells = line.split(',');
  for (const cell of cells) {
    if (/\d,\d/.test(cell)) {
      console.log('Found comma in number:', cell);
      commaNumbers++;
    }
  }
}
console.log('Total comma numbers:', commaNumbers);
