import { useEffect, useState } from 'react';
import { bdApi } from '../../context/services/api';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import TenderFormModal from './TenderFormModal';
import TenderDetailModal from './TenderDetailModal';
import { EoiFormModal, EoiDetailModal } from './EOIModals';
import { STATUS_BADGE, formatMoney, formatDate, SOURCE_LABEL } from './tenderConstants';

const TABS = [
  { id: 'tenders', label: 'Tenders' },
  { id: 'eoi', label: 'Expression of Interest' },
];

const TenderRow = ({ tender, onOpen }) => (
  <button
    onClick={() => onOpen(tender)}
    className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-navy-900 truncate">{tender.title}</span>
        <Badge label={tender.status} status={STATUS_BADGE[tender.status] || 'default'} />
        {tender.tenderType && <Badge label={tender.tenderType} status="default" />}
      </div>
      {tender.estimatedValue ? (
        <span className="text-xs font-semibold text-navy-900 shrink-0">{formatMoney(tender.estimatedValue)}</span>
      ) : null}
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
      {tender.reference && <span className="text-slate-700 font-medium">{tender.reference}</span>}
      {tender.source && <span>· {SOURCE_LABEL(tender.source, tender.sourceDetail)}</span>}
      {tender.issuingAuthority && <span>· {tender.issuingAuthority}</span>}
      {tender.deadline && <span>· due {formatDate(tender.deadline)}</span>}
      {tender.pdp?.individuals?.length > 0 && <span>· {tender.pdp.individuals.length} assigned</span>}
    </div>
  </button>
);

const EoiRow = ({ eoi, onOpen }) => (
  <button
    onClick={() => onOpen(eoi)}
    className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors first:rounded-t-xl last:rounded-b-xl"
  >
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-semibold text-navy-900 truncate">{eoi.title}</span>
        <Badge label={eoi.status} status={STATUS_BADGE[eoi.status] || 'default'} />
      </div>
      {eoi.attachmentType ? (
        <span className="text-[11px] text-slate-500 shrink-0">
          {eoi.attachmentType === 'link' ? '🔗 link' : '📎 file'}
        </span>
      ) : null}
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
      {eoi.reference && <span className="text-slate-700 font-medium">{eoi.reference}</span>}
      {eoi.source && <span>· {SOURCE_LABEL(eoi.source, eoi.sourceDetail)}</span>}
      {eoi.issuingAuthority && <span>· {eoi.issuingAuthority}</span>}
      {eoi.deadline && <span>· due {formatDate(eoi.deadline)}</span>}
    </div>
  </button>
);

const TendersModule = () => {
  const [tab, setTab] = useState('tenders');
  const [tenders, setTenders] = useState([]);
  const [eois, setEois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tenderForm, setTenderForm] = useState({ open: false, existing: null });
  const [tenderDetail, setTenderDetail] = useState(null);
  const [eoiForm, setEoiForm] = useState({ open: false, existing: null });
  const [eoiDetail, setEoiDetail] = useState(null);

  const refresh = () => {
    setLoading(true);
    Promise.all([bdApi.getTenders(), bdApi.getEois()])
      .then(([t, e]) => {
        setTenders(t);
        setEois(e);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([bdApi.getTenders(), bdApi.getEois()])
      .then(([t, e]) => {
        if (ignore) return;
        setTenders(t);
        setEois(e);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const handleDeleteTender = async (tender) => {
    if (!window.confirm(`Delete "${tender.title}"?`)) return;
    try {
      await bdApi.deleteTender(tender._id);
      setTenderDetail(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteEoi = async (eoi) => {
    if (!window.confirm(`Delete "${eoi.title}"?`)) return;
    try {
      await bdApi.deleteEoi(eoi._id);
      setEoiDetail(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const openTenderDetail = (tender) => setTenderDetail(tender);
  const openEoiDetail = (eoi) => setEoiDetail(eoi);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Tenders &amp; Expression of Interest</h1>
          <p className="text-sm text-slate-600">
            Track public notices and early signals — plan the bid (PDP) and the money (FDP).
          </p>
        </div>
        {tab === 'tenders' ? (
          <Button variant="primary" onClick={() => setTenderForm({ open: true, existing: null })}>
            + New tender
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setEoiForm({ open: true, existing: null })}>
            + New EOI
          </Button>
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
              tab === t.id ? 'border-navy-700 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'
            }`}
          >
            {t.label}
            {t.id === 'tenders' && tenders.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[11px]">{tenders.length}</span>
            )}
            {t.id === 'eoi' && eois.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-slate-100 text-[11px]">{eois.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : tab === 'tenders' ? (
        tenders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center py-12">
            <p className="text-3xl mb-2" aria-hidden="true">📑</p>
            <h3 className="text-base font-semibold text-navy-900">No tenders yet</h3>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Log a public notice to start planning the bid and its finances.
            </p>
            <div className="flex justify-center mt-4">
              <Button variant="primary" onClick={() => setTenderForm({ open: true, existing: null })}>
                + Create the first tender
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
            {tenders.map((t) => <TenderRow key={t._id} tender={t} onOpen={openTenderDetail} />)}
          </div>
        )
      ) : eois.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center py-12">
          <p className="text-3xl mb-2" aria-hidden="true">📨</p>
          <h3 className="text-base font-semibold text-navy-900">No expressions of interest yet</h3>
          <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
            Capture an early signal with its clipping, screenshot, link or note.
          </p>
          <div className="flex justify-center mt-4">
            <Button variant="primary" onClick={() => setEoiForm({ open: true, existing: null })}>
              + Create the first EOI
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
          {eois.map((e) => <EoiRow key={e._id} eoi={e} onOpen={openEoiDetail} />)}
        </div>
      )}

      {/* Tender modals */}
      {tenderForm.open && (
        <TenderFormModal
          open
          onClose={() => setTenderForm({ open: false, existing: null })}
          onSaved={(saved) => { setTenderForm({ open: false, existing: null }); setTenderDetail(saved); refresh(); }}
          existing={tenderForm.existing}
        />
      )}
      {tenderDetail && (
        <TenderDetailModal
          open
          onClose={() => setTenderDetail(null)}
          tender={tenderDetail}
          onEdit={(t) => { setTenderDetail(null); setTenderForm({ open: true, existing: t }); }}
          onDelete={handleDeleteTender}
        />
      )}

      {/* EOI modals */}
      {eoiForm.open && (
        <EoiFormModal
          open
          onClose={() => setEoiForm({ open: false, existing: null })}
          onSaved={(saved) => { setEoiForm({ open: false, existing: null }); setEoiDetail(saved); refresh(); }}
          existing={eoiForm.existing}
        />
      )}
      {eoiDetail && (
        <EoiDetailModal
          open
          onClose={() => setEoiDetail(null)}
          eoi={eoiDetail}
          onEdit={(e) => { setEoiDetail(null); setEoiForm({ open: true, existing: e }); }}
          onDelete={handleDeleteEoi}
        />
      )}
    </div>
  );
};

export default TendersModule;
