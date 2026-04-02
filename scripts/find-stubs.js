// Find notes that need AI-generated content.
// Triggers:
//   1. Stub: .md < 300 bytes with matching slide
//   2. New slide: slide file not seen in previous sync (tracked via .sync-state.json)
const fs = require('fs');
const path = require('path');

function getVaultPath() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(require('os').homedir(), '.e3rc.json'), 'utf-8'));
    if (config.vaultPath) return config.vaultPath;
  } catch {}
  try {
    const raw = fs.readFileSync(path.join(require('os').homedir(), '.e3.env'), 'utf-8');
    const match = raw.match(/^VAULT_PATH=(.+)$/m);
    if (match) return match[1].trim();
  } catch {}
  console.error('Error: vault path not set. Run: e3 config set vaultPath "..."');
  process.exit(1);
}

const vault = process.argv[2] || getVaultPath();
const STUB_THRESHOLD = 300;
const excludeDirs = ['Calendar', 'assets', 'daily', '.obsidian', '.git', '留學'];
const slideExts = ['.pdf', '.pptx', '.ppt', '.docx', '.doc'];

// Load previous sync state (known slides)
const stateFile = path.join(__dirname, '.sync-state.json');
let knownSlides = {};
try { knownSlides = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch {}

const currentSlides = {};
const results = [];

for (const dir of fs.readdirSync(vault)) {
  if (excludeDirs.includes(dir)) continue;
  const courseDir = path.join(vault, dir);
  if (!fs.statSync(courseDir).isDirectory()) continue;
  const slidesDir = path.join(courseDir, 'slides');
  if (!fs.existsSync(slidesDir)) continue;

  for (const file of fs.readdirSync(courseDir)) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(courseDir, file);
    const noteStat = fs.statSync(filePath);

    const baseName = file.replace(/\.md$/, '');
    const slides = fs.readdirSync(slidesDir).filter(s => {
      const sBase = s.replace(/\.[^.]+$/, '');
      return sBase === baseName || sBase.startsWith(baseName);
    });

    const matchedSlides = slides.filter(s => slideExts.some(ext => s.toLowerCase().endsWith(ext)));
    if (matchedSlides.length === 0) continue;

    // Track all current slides
    for (const s of matchedSlides) {
      currentSlides[path.join(slidesDir, s)] = true;
    }

    let reason = null;

    if (noteStat.size < STUB_THRESHOLD) {
      reason = 'stub';
    } else {
      // Check if any matched slide is NEW (not in previous state)
      const hasNewSlide = matchedSlides.some(s => !knownSlides[path.join(slidesDir, s)]);
      if (hasNewSlide) {
        reason = 'new-slide';
      }
    }

    if (reason) {
      results.push({
        course: dir,
        chapter: baseName,
        notePath: filePath,
        noteSize: noteStat.size,
        reason,
        pdfFiles: matchedSlides.map(s => path.join(slidesDir, s)),
      });
    }
  }
}

// Save current state for next run
fs.writeFileSync(stateFile, JSON.stringify(currentSlides, null, 2));

console.log(JSON.stringify(results, null, 2));
if (results.length > 0) process.exit(0);
else process.exit(1);
