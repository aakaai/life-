// Export des séances vélo au format Zwift (.zwo).
// Dans Zwift : Entraînement > Custom Workouts. Sur Mac, copie le fichier dans
// Documents/Zwift/Workouts/<ton numéro Zwift>/ puis relance Zwift.

const pct = (b) => ((b.lo + b.hi) / 2 / 100).toFixed(2)
const sec = (min) => Math.round(min * 60)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

function steady(b) {
  if (/chauffement/i.test(b.label)) {
    return `    <Warmup Duration="${sec(b.min)}" PowerLow="${(b.lo / 100).toFixed(2)}" PowerHigh="${(b.hi / 100).toFixed(2)}"/>`
  }
  if (/retour au calme/i.test(b.label)) {
    return `    <Cooldown Duration="${sec(b.min)}" PowerLow="${(b.hi / 100).toFixed(2)}" PowerHigh="${(b.lo / 100).toFixed(2)}"/>`
  }
  return `    <SteadyState Duration="${sec(b.min)}" Power="${pct(b)}"/>`
}

export function toZwo({ name, description, blocks }) {
  const lines = []
  for (const b of blocks) {
    if (!b.repeat) {
      lines.push(steady(b))
      continue
    }
    const { work, rest } = b
    if (work.micro) {
      // séries de 30/15 : un bloc d'intervalles par série, récupération entre les séries
      for (let i = 0; i < b.repeat; i++) {
        lines.push(
          `    <IntervalsT Repeat="${work.micro.reps}" OnDuration="${work.micro.on}" OffDuration="${work.micro.off}" OnPower="${pct(work)}" OffPower="${(work.micro.offPct / 100).toFixed(2)}"/>`
        )
        if (i < b.repeat - 1) lines.push(steady(rest))
      }
      continue
    }
    lines.push(
      `    <IntervalsT Repeat="${b.repeat}" OnDuration="${sec(work.min)}" OffDuration="${sec(rest.min)}" OnPower="${pct(work)}" OffPower="${pct(rest)}"/>`
    )
  }
  return `<workout_file>
  <author>Life</author>
  <name>${esc(name)}</name>
  <description>${esc(description || '')}</description>
  <sportType>bike</sportType>
  <tags><tag name="Life"/></tags>
  <workout>
${lines.join('\n')}
  </workout>
</workout_file>
`
}

export function downloadZwo(workout, filename) {
  const blob = new Blob([toZwo(workout)], { type: 'application/xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
