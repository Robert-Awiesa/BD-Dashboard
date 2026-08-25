import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';
import Modal from '../common/Modal';
import Button from '../common/Button';

// Who is filing this? Every module stamps the active team member onto uploads,
// visit write-ups, interaction logs and comments.
//
// The roster is everyone who has ever been set here, plus everyone registered
// as a Team Member milestone under Events & Forums. It lives on the server, so
// a name typed on one machine is on the list for the whole team.
//
// Layout: the inline control only appears from `sm` up. On a phone the header
// already carries a menu button, a search box, a status pill and Quick Log —
// dropping a text input in beside them crushed the lot. Phones get a single
// avatar button that opens the same choice in a dialog.
const TeamMemberPicker = () => {
  const { currentUser, setCurrentUser } = useDashboard();
  const [roster, setRoster] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadRoster = () =>
    bdApi.getTeamRoster()
      .then((rows) => setRoster(rows.map((r) => r.name).filter(Boolean)))
      .catch(() => { /* a typed name still works without the roster */ });

  useEffect(() => {
    let ignore = false;
    bdApi.getTeamRoster()
      .then((rows) => { if (!ignore) setRoster(rows.map((r) => r.name).filter(Boolean)); })
      .catch(() => { /* a typed name still works without the roster */ });
    return () => { ignore = true; };
  }, []);

  // Somebody not on the roster yet still needs to show as the current choice.
  const options = currentUser && !roster.includes(currentUser)
    ? [currentUser, ...roster]
    : roster;

  const commit = async (name) => {
    const clean = (name ?? draft).trim();
    setDraft('');
    setAdding(false);
    if (!clean) return;
    setCurrentUser(clean);
    try {
      await bdApi.addTeamMember(clean);
      await loadRoster();
    } catch {
      setRoster((prev) => (prev.includes(clean) ? prev : [...prev, clean].sort()));
    }
  };

  const initial = currentUser ? currentUser.slice(0, 1).toUpperCase() : '?';

  const inline = adding || (!currentUser && roster.length === 0) ? (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        placeholder="Your name"
        aria-label="Your name"
        className="form-input text-xs py-1 w-28"
        autoFocus
      />
      <button
        type="button"
        onClick={() => commit()}
        className="text-xs font-medium text-navy-700 hover:underline cursor-pointer"
      >
        Set
      </button>
      {roster.length > 0 && (
        <button
          type="button"
          onClick={() => { setAdding(false); setDraft(''); }}
          className="text-xs text-slate-500 hover:text-navy-800 cursor-pointer"
        >
          Cancel
        </button>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-1.5">
      {currentUser && (
        <span
          className="w-6 h-6 shrink-0 rounded-full bg-navy-700 text-white text-[11px] font-semibold flex items-center justify-center"
          aria-hidden="true"
        >
          {initial}
        </span>
      )}
      <select
        value={currentUser || ''}
        onChange={(e) => {
          if (e.target.value === '__add__') setAdding(true);
          else setCurrentUser(e.target.value);
        }}
        aria-label="Recording as"
        className="form-input text-xs py-1 max-w-32"
      >
        {!currentUser && <option value="">Who are you?</option>}
        {options.map((name) => <option key={name} value={name}>{name}</option>)}
        <option value="__add__">+ Someone else…</option>
      </select>
    </div>
  );

  return (
    <>
      <div className="hidden sm:flex items-center">{inline}</div>

      {/* Phones: one tap target, and the choice moves into a dialog. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={currentUser ? `Change who is recording (currently ${currentUser})` : 'Set who is recording'}
        className={`sm:hidden w-8 h-8 shrink-0 rounded-full text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors ${
          currentUser
            ? 'bg-navy-700 text-white'
            : 'bg-amber-100 text-amber-800 border border-amber-300'
        }`}
      >
        {initial}
      </button>

      <Modal
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setAdding(false); setDraft(''); }}
        title="Who is recording?"
        description="Your name is stamped on everything you file from here."
      >
        <div className="space-y-3">
          {options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { setCurrentUser(name); setSheetOpen(false); }}
                  aria-pressed={currentUser === name}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer transition-colors ${
                    currentUser === name
                      ? 'bg-navy-700 text-white border-navy-700'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-navy-400'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div>
            <label className="form-label" htmlFor="team-picker-new">Someone else</label>
            <div className="flex items-center gap-2">
              <input
                id="team-picker-new"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  commit();
                  setSheetOpen(false);
                }}
                placeholder="Type a name"
                className="form-input"
              />
              <Button
                variant="secondary"
                onClick={() => { commit(); setSheetOpen(false); }}
              >
                Set
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Adding a name here puts it on the roster for the whole team.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default TeamMemberPicker;
