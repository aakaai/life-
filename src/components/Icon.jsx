// Icônes en SVG inline (aucune dépendance, fonctionnent hors ligne).
const paths = {
  home: <><path d="M4 10.5L12 4l8 6.5" /><path d="M6 9v10.5h4.5V14h3v5.5H18V9" /></>,
  today:<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" /></>,
  sport: <><circle cx="6" cy="16.5" r="3.5" /><circle cx="18" cy="16.5" r="3.5" /><path d="M6 16.5l4-7h5.5M10 9.5l3.5 7H18M14 6h2.5l2 3" /></>,
  alimentation: <><path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5" /><path d="M17 21V3c-2 1.5-3 4-3 7v3h3" /></>,
  budget: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><path d="M15.5 14.5h2.5" /></>,
  ecole: <><path d="M2.5 9L12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v4.5c1.5 1.3 3.4 2 5.5 2s4-.7 5.5-2V11M21.5 9v5" /></>,
  loisirs: <><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" /></>,
  more: <><circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  habitudes: <><circle cx="12" cy="12" r="8.5" /><path d="M8 12.3l2.8 2.8L16.2 9.5" /></>,
  flame: <path d="M12 3.5c.5 3-2.5 4.5-2.5 8a2.5 2.5 0 0 0 5 0c0-1-.4-1.8-1-2.5 2.7 1 4.5 3.6 4.5 6.5a6 6 0 0 1-12 0c0-4.6 3.4-6.6 6-12z" />,
  pause: <><path d="M9 5.5v13M15 5.5v13" /></>,
  chevron: <path d="M9 5l7 7-7 7" />,
  back: <path d="M15 5l-7 7 7 7" />,
  stretch: <><circle cx="12" cy="4.5" r="1.8" /><path d="M5.5 10.5 12 8.5l6.5-3M12 8.5v5M12 13.5l-5 6.5M12 13.5l4.5 3V20" /></>,
  dumbbell: <><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  taches: <><path d="M10 6.5h10M10 12h10M10 17.5h10" /><path d="M3.5 6.5l1.6 1.6L8 5.2M3.5 12l1.6 1.6L8 10.7M3.5 17.5l1.6 1.6L8 16.2" /></>,
  refresh: <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></>,
  download: <><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  timer: <><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V10M10 3h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  bolt: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
  star: <path d="M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />,
  search: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>,
  barcode: <><path d="M4 6v12M7 6v12M10.5 6v12M13 6v12M16.5 6v12M20 6v12" /></>,
  camera: <><path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4z" /><circle cx="12" cy="13.5" r="3.3" /></>,
  scale: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 11a4.6 4.6 0 0 1 8 0" /><path d="M12 11l1.6-2.2" /></>,
  box: <><path d="M4 8.5L12 5l8 3.5v8L12 20l-8-3.5z" /><path d="M4 8.5l8 3.5 8-3.5M12 12v8" /></>,
  pan: <><path d="M3.5 12.5h13a0 0 0 0 1 0 0 5.5 5.5 0 0 1-5.5 5.5h-2a5.5 5.5 0 0 1-5.5-5.5z" /><path d="M16.5 13.5h4M8 9c0-1.5 1-1.5 1-3M12 9c0-1.5 1-1.5 1-3" /></>,
  sparkle: <path d="M12 4l1.6 4.8L18.5 10.5l-4.9 1.7L12 17l-1.6-4.8-4.9-1.7 4.9-1.7z" />,
  book: <><path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z" /><path d="M5 18a2 2 0 0 1 2-2h10.5" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  drop: <path d="M12 3.5s6 6.4 6 10.8a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />,
  pill: <><rect x="3.2" y="8.5" width="17.6" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M9.5 9.5l5 5" /></>,
  heart: <path d="M12 19.5s-7.5-4.4-7.5-10a4.1 4.1 0 0 1 7.5-2.3 4.1 4.1 0 0 1 7.5 2.3c0 5.6-7.5 10-7.5 10z" />,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 17.5h2" /></>,
  leaf: <><path d="M5 19c0-8 5-13.5 14-14 .5 9-5 14-13 14z" /><path d="M5 19 13 11" /></>,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6.5 3 2.5V21M8 12l2-4.5 3.5.5 2 3.5 2.5.5M12 14.5l-1-4" /></>,
  brain: <><path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.3A3 3 0 0 0 8 17.5a2.5 2.5 0 0 0 4 1V5.5A2.5 2.5 0 0 0 9 4.5z" /><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.3A3 3 0 0 1 16 17.5a2.5 2.5 0 0 1-4 1" /></>,
  flag: <><path d="M5.5 21V4" /><path d="M5.5 4.5h11.5l-2.5 4 2.5 4H5.5" /></>,
  folder: <path d="M3.5 7a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  bag: <><path d="M6 8h12l-1 12H7L6 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>
}

export default function Icon({ name, size = 22, stroke = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
