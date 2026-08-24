import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import { useDashboard } from '../../context/hooks/DashboardContext';

// Who is filing this? Every module stamps the active team member onto uploads,
// visit write-ups, interaction logs and comments, but until now that name could
// only be changed from inside Reports — so whoever set it first became the
// author of everything the whole team recorded.
//
// The roster is everyone who has ever been set here, plus everyone registered
// as a Team Member milestone under Events & Forums. It lives on the server, so
// a name typed on one machine is on the list for the whole team — it used to
// sit in that browser's localStorage and nobody else ever saw it.
const TeamMemberPicker = () => {
  const { currentUser, setCurrentUser } = useDashboard();
  const [roster, setRoster] = useState([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let ignore = false;
    bdApi.getTeamRoster()
      .then((rows) => { if (!ignore) setRoster(rows.map((r) => r.name).filter(Boolean)); })
      .catch(() => { /* the picker still works with a typed name */ });
    return () => { ignore = true; };
  }, []);

  // Somebody who is not on the roster yet still needs to appear as the current
  // selection until they are added properly.
  const options = currentUser && !roster.includes(currentUser)
    ? [currentUser, ...roster]
    : roster;

  const commit = async () => {
    const name = draft.trim();
    setDraft('');
    setAdding(false);
    if (!name) return;
    setCurrentUser(name);
    // Put them on the shared roster so the next person sees the name too.
    try {
      await bdApi.addTeamMember(name);
      const rows = await bdApi.getTeamRoster();
      setRoster(rows.map((r) => r.name).filter(Boolean));
    } catch {
      // The name is still set locally; the roster catches up on next load.
      setRoster((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
    }
  };

  if (adding || (!currentUser && roster.length === 0)) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          placeholder="Your name"
          aria-label="Your name"
          className="form-input text-xs py-1 w-32"
          autoFocus
        />
        <button
          type="button"
          onClick={commit}
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
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {currentUser && (
        <span
          className="w-6 h-6 shrink-0 rounded-full bg-navy-700 text-white text-[11px] font-semibold flex items-center justify-center"
          aria-hidden="true"
        >
          {currentUser.slice(0, 1).toUpperCase()}
        </span>
      )}
      <select
        value={currentUser || ''}
        onChange={(e) => {
          if (e.target.value === '__add__') setAdding(true);
          else setCurrentUser(e.target.value);
        }}
        aria-label="Recording as"
        className="form-input text-xs py-1 max-w-36"
      >
        {!currentUser && <option value="">Who are you?</option>}
        {options.map((name) => <option key={name} value={name}>{name}</option>)}
        <option value="__add__">+ Someone else…</option>
      </select>
    </div>
  );
};

export default TeamMemberPicker;
