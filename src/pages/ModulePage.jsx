import ModuleIcon from '../components/ModuleIcon'

// Page d'un module, mise en page façon Notion : grande icône, titre,
// propriétés, puis le contenu (ou un encadré tant que le module n'existe pas).
export default function ModulePage({ module: m }) {
  if (m.component) {
    const Component = m.component
    return <Component />
  }

  return (
    <div className="page doc-page" style={{ '--c': m.color }}>
      <header className="doc-head">
        <ModuleIcon module={m} size={64} />
        <h1 className="doc-title">{m.label}</h1>
        <dl className="props">
          <div className="prop">
            <dt>Statut</dt>
            <dd><span className="tag">À venir</span></dd>
          </div>
          <div className="prop">
            <dt>Étape</dt>
            <dd>{m.step}</dd>
          </div>
        </dl>
      </header>
      <div className="callout">
        <span className="callout-icon" aria-hidden="true">💡</span>
        <div>
          <p className="callout-lead">{m.summary}</p>
          <p className="callout-text">
            Cet espace est en préparation. Son contenu se décide ensemble avant d’être construit.
          </p>
        </div>
      </div>
    </div>
  )
}
