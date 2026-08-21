// Sidebar iconography.
//
// These were colour emoji, which render as small cartoon glyphs — a different
// illustration style per icon, fixed colours that ignore the active state, and
// a different shape on every OS. These are stroke icons on a 24x24 grid drawn
// at a single weight, and they paint in `currentColor`, so a nav item's icon
// takes the same slate/navy as its label and goes navy when the item is active.

const PATHS = {
  // Bar chart — the pipeline read at a glance.
  pipeline: (
    <>
      <path d="M3.75 20.25h16.5" />
      <path d="M6.75 20.25v-6" />
      <path d="M11.25 20.25V9" />
      <path d="M15.75 20.25v-8.25" />
      <path d="M20.25 20.25V5.25" />
    </>
  ),
  // Clipboard with ruled lines — a submission document.
  tenders: (
    <>
      <path d="M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13.5A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H15" />
      <path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5v.75h-6V4.5Z" />
      <path d="M9 11.25h6M9 14.25h6M9 17.25h3" />
    </>
  ),
  // Calendar.
  events: (
    <>
      <rect x="3.75" y="5.25" width="16.5" height="15" rx="1.5" />
      <path d="M3.75 9.75h16.5" />
      <path d="M8.25 3v4.5M15.75 3v4.5" />
    </>
  ),
  // Map pin.
  'field-visits': (
    <>
      <path d="M19.5 10.5c0 6-7.5 10.5-7.5 10.5S4.5 16.5 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      <circle cx="12" cy="10.5" r="2.625" />
    </>
  ),
  // Ticked list.
  tasks: (
    <>
      <path d="M3.75 6.75 5.25 8.25l2.25-2.25" />
      <path d="M3.75 12.75l1.5 1.5 2.25-2.25" />
      <path d="M3.75 18.75l1.5 1.5 2.25-2.25" />
      <path d="M11.25 7.5h9M11.25 13.5h9M11.25 19.5h9" />
    </>
  ),
  // Share node — one post reaching several places.
  'social-media': (
    <>
      <circle cx="18" cy="5.25" r="2.25" />
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="18.75" r="2.25" />
      <path d="M8.04 10.86l7.92-4.47M8.04 13.14l7.92 4.47" />
    </>
  ),
  // Two people — an account and the person who holds it.
  'client-relations': (
    <>
      <circle cx="9.75" cy="8.25" r="3" />
      <path d="M3.75 19.5a6 6 0 0 1 12 0" />
      <path d="M16.5 6.15a3 3 0 0 1 0 5.7" />
      <path d="M18 14.4a5.25 5.25 0 0 1 3.75 5.1" />
    </>
  ),
  // Office block.
  partners: (
    <>
      <path d="M3.75 20.25h16.5" />
      <path d="M5.25 20.25V4.5A1.5 1.5 0 0 1 6.75 3h6a1.5 1.5 0 0 1 1.5 1.5v15.75" />
      <path d="M14.25 20.25V9.75h3a1.5 1.5 0 0 1 1.5 1.5v9" />
      <path d="M8.25 6.75h3M8.25 10.5h3M8.25 14.25h3" />
    </>
  ),
  // Document with a folded corner.
  proposals: (
    <>
      <path d="M14.25 3H6.75A1.5 1.5 0 0 0 5.25 4.5v15A1.5 1.5 0 0 0 6.75 21h10.5a1.5 1.5 0 0 0 1.5-1.5V7.5L14.25 3Z" />
      <path d="M14.25 3v3a1.5 1.5 0 0 0 1.5 1.5h3" />
      <path d="M8.25 12.75h7.5M8.25 16.5h4.5" />
    </>
  ),
  // Mortarboard.
  training: (
    <>
      <path d="M2.25 8.25 12 3.75l9.75 4.5L12 12.75 2.25 8.25Z" />
      <path d="M6 10.5v5.25c0 1.24 2.686 2.25 6 2.25s6-1.01 6-2.25V10.5" />
      <path d="M21 9v5.25" />
    </>
  ),
  // Trend line on a page.
  reports: (
    <>
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="1.5" />
      <path d="M7.5 15l3-3.75 2.25 2.25L16.5 9" />
      <path d="M16.5 9h-2.25M16.5 9v2.25" />
    </>
  ),
  // Spanner.
  tools: (
    <>
      <path d="M15.6 3.9a5.25 5.25 0 0 0-6.36 6.78L3.9 16.02a1.86 1.86 0 1 0 2.63 2.63l5.34-5.34a5.25 5.25 0 0 0 6.78-6.36l-2.79 2.79-2.85-.57-.57-2.85L15.6 3.9Z" />
    </>
  ),
  // Newspaper.
  blog: (
    <>
      <path d="M18 20.25H5.25A1.5 1.5 0 0 1 3.75 18.75V5.25A1.5 1.5 0 0 1 5.25 3.75h10.5A1.5 1.5 0 0 1 17.25 5.25v13.5a1.5 1.5 0 0 0 1.5 1.5Z" />
      <path d="M17.25 8.25h1.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5" />
      <rect x="6.75" y="6.75" width="4.5" height="3.75" />
      <path d="M6.75 13.5h7.5M6.75 16.5h7.5" />
    </>
  ),
};

const NavIcon = ({ id, className = 'w-5 h-5' }) => {
  const paths = PATHS[id];
  if (!paths) return null;
  return (
    <svg
      className={`${className} shrink-0`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
};

export default NavIcon;
