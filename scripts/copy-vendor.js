const fs = require('fs');
const path = require('path');

const vendorDir = path.join(__dirname, '..', 'www', 'vendor');
fs.mkdirSync(vendorDir, { recursive: true });

const bundles = [
  {
    dest: 'supabase.min.js',
    candidates: [
      ['@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'],
      ['@supabase', 'supabase-js', 'dist', 'umd', 'supabase.min.js']
    ]
  },
  {
    dest: 'html2canvas.min.js',
    candidates: [
      ['html2canvas', 'dist', 'html2canvas.min.js'],
      ['html2canvas', 'dist', 'html2canvas.js']
    ]
  },
  {
    dest: 'jspdf.umd.min.js',
    candidates: [
      ['jspdf', 'dist', 'jspdf.umd.min.js'],
      ['jspdf', 'dist', 'jspdf.umd.js']
    ]
  }
];

for (const b of bundles) {
  const found = b.candidates
    .map(parts => path.join(__dirname, '..', 'node_modules', ...parts))
    .find(p => fs.existsSync(p));
  if (!found) {
    throw new Error(`Missing vendor bundle for ${b.dest}`);
  }
  const target = path.join(vendorDir, b.dest);
  fs.copyFileSync(found, target);
  console.log(`Copied ${b.dest} from ${found} (${fs.statSync(target).size} bytes)`);
}
