interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export type IconName =
  | 'home'
  | 'sparkles'
  | 'film'
  | 'translate'
  | 'image'
  | 'pen'
  | 'bot'
  | 'shield'
  | 'folder'
  | 'settings'
  | 'plus'
  | 'download'
  | 'play'
  | 'stop'
  | 'trash'
  | 'copy'
  | 'upload'
  | 'refresh'
  | 'globe'
  | 'sun'
  | 'moon'
  | 'check'
  | 'x'
  | 'alert'
  | 'volume'
  | 'clock'
  | 'layers'
  | 'chevron-right'
  | 'chevron-left'
  | 'search'
  | 'grid'
  | 'wand';

const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5',
  sparkles: 'M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zM18 16.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z',
  film: 'M3.5 4.5h17v15h-17zM3.5 9h17M3.5 15h17M8 4.5v15M16 4.5v15',
  translate: 'M4 5h9M8.5 5v2c0 3.6-2 6.6-5 8M6 10c1.2 2.6 3.4 4.6 6 5.5M13 20l4-10 4 10M14.6 16.4h4.8',
  image: 'M3.5 5h17v14h-17zM8.5 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM4 17l5-5 4 4 3-3 4 4',
  pen: 'M4 20l4-1 10-10-3-3L5 16l-1 4zM14.5 6.5l3 3',
  bot: 'M7 8h10a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM12 4v4M9.5 13.5v.01M14.5 13.5v.01M9 17h6',
  shield: 'M12 3l7 3v6c0 4.2-2.9 7.7-7 9-4.1-1.3-7-4.8-7-9V6l7-3zM9 12l2 2 4-4',
  folder: 'M3.5 6.5h6l2 2h9v10h-17z',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 0 1 0-4 1.7 1.7 0 0 0 1.4-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 0 1 0 4z',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 19h14',
  play: 'M8 5.5v13l11-6.5-11-6.5z',
  stop: 'M7 7h10v10H7z',
  trash: 'M4.5 7h15M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10.5 11v6M13.5 11v6',
  copy: 'M9 9V5.5h10.5V16H16M4.5 9H15v10.5H4.5z',
  upload: 'M12 20V9m0 0-4 4m4-4 4 4M5 5h14',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 4 3 19.5h18L12 4zM12 10v4.5M12 17.5v.01',
  volume: 'M4 10v4h3l4 3.5v-11L7 10H4zM15.5 9.5a4 4 0 0 1 0 5M18 7a7.5 7.5 0 0 1 0 10',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  layers: 'M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 16.5l9 5 9-5',
  'chevron-right': 'M9.5 5.5 16 12l-6.5 6.5',
  'chevron-left': 'M14.5 5.5 8 12l6.5 6.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16.2 16.2 21 21',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  wand: 'M6 18 18 6M15 5l1 1M19 9l1 1M14 3.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8.8-1.7z',
};

export function Icon({ name, size = 18, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
