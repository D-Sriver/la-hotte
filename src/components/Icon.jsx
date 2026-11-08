// Icônes au trait, dessinées sur une grille de 24 px.
const PATHS = {
  family: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 13.6c2.8 0 5 1.9 5 4.9" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5c-1.5-3.5-5.5-4-5.5-1.5 0 1.5 2.5 1.5 5.5 1.5Zm0 0c1.5-3.5 5.5-4 5.5-1.5 0 1.5-2.5 1.5-5.5 1.5Z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  chevron: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sparkle: (
    <path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5ZM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" />
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  logout: <path d="M14 5h3.5A1.5 1.5 0 0 1 19 6.5v11a1.5 1.5 0 0 1-1.5 1.5H14M10 8l-4 4 4 4M6 12h9" />,
  star: <path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6L12 4Z" />,
  pencil: <path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L9 18l-4 1ZM13.5 7.5l3 3" />,
  bag: (
    <>
      <path d="M5.5 8.5h13l-1 11h-11l-1-11Z" />
      <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  share: (
    <>
      <path d="M12 4v11M8 8l4-4 4 4" />
      <path d="M6 11.5V18a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 18v-6.5" />
    </>
  ),
  chat: (
    <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V16h0a2 2 0 0 1-2-2V6.5Z" />
  ),
  cake: (
    <>
      <path d="M4.5 20h15M5.5 20v-6.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5V20" />
      <path d="M5.5 15.5c1.2 1 2.4 1 3.6 0s2.4-1 3.6 0 2.4 1 3.6 0 1.6-.6 2.2-.6M12 12V8.5M12 6.5c-.8-.7-.8-1.6 0-2.5.8.9.8 1.8 0 2.5Z" />
    </>
  ),
  download: <path d="M12 4v11M8 11l4 4 4-4M5 19.5h14" />,
  bell: <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14l1.5-2ZM10 20.5a2 2 0 0 0 4 0" />,
  more: (
    <>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  move: (
    <path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
  ),
  heart: <path d="M12 19.5s-7-4.4-7-9.5a3.8 3.8 0 0 1 7-2.1A3.8 3.8 0 0 1 19 10c0 5.1-7 9.5-7 9.5Z" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M6.7 6.7l10.6 10.6" />
    </>
  ),
  ruler: <path d="M4.5 15.5 15.5 4.5l4 4-11 11-4-4ZM8 12l1.5 1.5M10.5 9.5 12 11M13 7l1.5 1.5" />,
  wallet: (
    <>
      <path d="M5 7.5h12.5A1.5 1.5 0 0 1 19 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5V7.5Zm0 0V6.5A1.5 1.5 0 0 1 6.5 5H16" />
      <circle cx="15.5" cy="13.25" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  thumbUp: (
    <path d="M7.5 10.5v9h-3v-9h3Zm0 0 3.5-6.5c1.4 0 2.3 1.1 2 2.5l-.6 3h5.1a1.8 1.8 0 0 1 1.8 2.1l-1.1 6.2a1.8 1.8 0 0 1-1.8 1.7H7.5" />
  ),
  thumbDown: (
    <path d="M7.5 13.5v-9h-3v9h3Zm0 0 3.5 6.5c1.4 0 2.3-1.1 2-2.5l-.6-3h5.1a1.8 1.8 0 0 0 1.8-2.1l-1.1-6.2a1.8 1.8 0 0 0-1.8-1.7H7.5" />
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
};

export default function Icon({ name, size = 22 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
