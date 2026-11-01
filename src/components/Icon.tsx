const paths = {
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5 9.5 17 19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  table: 'M4 5h16v14H4zM4 10h16M10 5v14',
  bars: 'M5 19V10M12 19V5M19 19v-7',
  box: 'M3.6 8.2 12 4l8.4 4.2v7.6L12 20l-8.4-4.2zM3.6 8.2 12 12.4l8.4-4.2M12 12.4V20',
  camera: 'M4 8h3l1.5-2h7L17 8h3v10H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  menu: 'M5 7h14M5 12h14M5 17h14',
  search: 'M11 18.5a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zM20.5 20.5l-4-4',
} as const

export type IconName = keyof typeof paths

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        d={paths[name]}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
