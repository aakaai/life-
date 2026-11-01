// Génère les icônes PNG de l'app à partir d'un SVG (npm run icons).
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'node:fs'

const bars = [
  ['#529CCA', 0.62], // sport
  ['#4DAB9A', 0.48], // alimentation
  ['#9A6DD7', 0.72], // école
  ['#FFDC49', 0.40], // budget
  ['#E255A1', 0.56]  // loisirs
]

// pad = marge intérieure (plus grande pour l'icône "maskable")
function svg(size, { pad = 0.2, radius = 0.22 } = {}) {
  const s = size
  const inner = s * (1 - 2 * pad)
  const barH = inner / (bars.length * 1.7)
  const gap = barH * 0.7
  const rects = bars
    .map(([c, w], i) => {
      const y = s * pad + i * (barH + gap) + barH * 0.35
      return `<rect x="${s * pad}" y="${y}" width="${inner * w + inner * 0.25}" height="${barH}" rx="${barH / 2}" fill="${c}"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<rect width="${s}" height="${s}" rx="${s * radius}" fill="#37352F"/>${rects}</svg>`
}

mkdirSync('public', { recursive: true })
writeFileSync('public/favicon.svg', svg(64))

const out = [
  ['public/icon-192.png', 192, {}],
  ['public/icon-512.png', 512, {}],
  ['public/icon-maskable-512.png', 512, { pad: 0.28, radius: 0 }],
  ['public/apple-touch-icon.png', 180, { radius: 0 }]
]
for (const [file, size, opts] of out) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(file)
  console.log('✓', file)
}
