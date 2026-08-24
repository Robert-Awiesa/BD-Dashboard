// Celebration iconography.
//
// Birthdays and milestones used the same colour emoji, so a work anniversary
// and a birthday were indistinguishable at a glance — and the cake glyph
// rendered as a cartoon that sat oddly against the rest of the workspace.
//
// These are stroke icons on the same 24x24 grid and weight as the sidebar set,
// drawn in `currentColor` so the caller decides the colour: warm for a
// birthday, cool for a milestone.

const Svg = ({ children, className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

// A tiered cake with one candle — unmistakably a birthday, but drawn as line
// art rather than a colour glyph.
export const BirthdayIcon = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M4.5 20.25h15" />
    <path d="M5.25 20.25v-5.25a1.5 1.5 0 0 1 1.5-1.5h10.5a1.5 1.5 0 0 1 1.5 1.5v5.25" />
    <path d="M5.25 16.5c1.125 0 1.125 1.125 2.25 1.125S8.625 16.5 9.75 16.5s1.125 1.125 2.25 1.125S13.125 16.5 14.25 16.5s1.125 1.125 2.25 1.125 1.125-1.125 2.25-1.125" />
    <path d="M12 13.5V9.75" />
    <path d="M12 7.5c0-1.125-1.125-1.5-1.125-2.625A1.125 1.125 0 0 1 12 3.75a1.125 1.125 0 0 1 1.125 1.125C13.125 6 12 6.375 12 7.5Z" />
  </Svg>
);

// An award medal with ribbon tails — tenure and achievement, not a party.
export const MilestoneIcon = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <circle cx="12" cy="9" r="5.25" />
    <path d="M12 6.75l.9 1.83 2.02.29-1.46 1.42.34 2.01L12 11.35l-1.8.95.34-2.01L9.08 8.87l2.02-.29L12 6.75Z" />
    <path d="M8.25 13.5L6.75 21l5.25-2.25L17.25 21l-1.5-7.5" />
  </Svg>
);

// A partnership milestone: two links joined, which reads differently from a
// personal award without needing a handshake nobody can draw at this size.
export const PartnershipIcon = ({ className = 'w-5 h-5' }) => (
  <Svg className={className}>
    <path d="M10.5 13.5a3.75 3.75 0 0 0 5.66.41l2.25-2.25a3.75 3.75 0 0 0-5.3-5.3l-1.29 1.28" />
    <path d="M13.5 10.5a3.75 3.75 0 0 0-5.66-.41l-2.25 2.25a3.75 3.75 0 0 0 5.3 5.3l1.28-1.28" />
  </Svg>
);

// Picks the right one for a celebration row. Milestone types that are about a
// relationship get the partnership mark; everything else splits on kind.
export const CelebrationIcon = ({ kind, milestoneType, className }) => {
  if (kind === 'Birthday') return <BirthdayIcon className={className} />;
  if (milestoneType === 'Partner Milestone' || milestoneType === 'Client Anniversary') {
    return <PartnershipIcon className={className} />;
  }
  return <MilestoneIcon className={className} />;
};

export default CelebrationIcon;
