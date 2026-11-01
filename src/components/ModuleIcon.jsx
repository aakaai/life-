import Icon from './Icon'

// Icône d'un module dans un carré arrondi teinté (style réglages iOS),
// à la couleur du module.
export default function ModuleIcon({ module: m, size = 36 }) {
  return (
    <span className="mod-icon" style={{ '--c': m.color, width: size, height: size }}>
      <Icon name={m.icon} size={Math.round(size * 0.58)} stroke={1.9} />
    </span>
  )
}
