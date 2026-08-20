import { useState } from 'react';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import {
  STATUS_BADGE,
  formatMoney,
  formatDate,
  SOURCE_LABEL,
} from './tenderConstants';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'pdp', label: 'PDP' },
  { id: 'fdp', label: 'FDP' },
];

const MetaRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
    <span className="text-xs text-slate-500 shrink-0">{label}</span>
    <span className="text-xs text-navy-900 font-medium text-right min-w-0">{children}</span>
  </div>
);

const ProgressBar = ({ value }) => (
  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
    <div className="h-full bg-navy-700 rounded-full" style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} />
  </div>
);

const TenderDetailModal = ({ open, onClose, tender, onEdit, onDelete }) => {
  const [tab, setTab] = useState('overview');
  const [showFdp, setShowFdp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!tender) return null;

  const fdp = tender.fdp || {};
  const pdp = tender.pdp || { milestones: [], individuals: [], progress: 0 };

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-2">
      <span className="text-xs text-slate-500">
        {formatMoney(tender.estimatedValue)} est.
      </span>
      <div className="flex flex-wrap gap-2">
        {confirmDelete ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Keep</Button>
            <Button variant="danger" onClick={() => onDelete(tender)}>Delete</Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
            <Button variant="primary" onClick={() => onEdit(tender)}>✎ Edit</Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={tender.title}
      description={`${tender.tenderType || 'Tender'}${tender.reference ? ` · ${tender.reference}` : ''}${tender.issuingAuthority ? ` · ${tender.issuingAuthority}` : ''}`}
      footer={footer}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge label={tender.status} status={STATUS_BADGE[tender.status] || 'default'} />
          {tender.source && <Badge label={SOURCE_LABEL(tender.source, tender.sourceDetail)} status="default" />}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-navy-900">{formatMoney(tender.estimatedValue)}</p>
            <p className="text-[11px] text-slate-500">Est. value</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-navy-900">{Number(pdp.progress) || 0}%</p>
            <p className="text-[11px] text-slate-500">PDP progress</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-lg font-bold text-navy-900">{formatDate(tender.deadline)}</p>
            <p className="text-[11px] text-slate-500">Deadline</p>
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px cursor-pointer transition-colors ${
                tab === t.id ? 'border-navy-700 text-navy-900' : 'border-transparent text-slate-500 hover:text-navy-700'
              }`}
            >
              {t.label}
              {t.id === 'pdp' && (pdp.individuals?.length || pdp.milestones?.length) > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px]">
                  {(pdp.individuals?.length || 0) + (pdp.milestones?.length || 0)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <MetaRow label="Reference">{tender.reference || '—'}</MetaRow>
              <MetaRow label="Type">{tender.tenderType || '—'}</MetaRow>
              <MetaRow label="Issuing authority">{tender.issuingAuthority || '—'}</MetaRow>
              <MetaRow label="Source">{SOURCE_LABEL(tender.source, tender.sourceDetail)}</MetaRow>
              <MetaRow label="Deadline">{formatDate(tender.deadline)}</MetaRow>
              <MetaRow label="Status">{tender.status}</MetaRow>
            </div>
            {tender.notes && (
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</p>
                <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{tender.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* PDP */}
        {tab === 'pdp' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-navy-900">Progress</span>
                <span className="text-xs text-slate-500">{Number(pdp.progress) || 0}%</span>
              </div>
              <ProgressBar value={pdp.progress} />
            </div>

            {pdp.objectives && (
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Objectives</p>
                <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{pdp.objectives}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-navy-900 mb-1.5">
                Individuals responsible ({pdp.individuals?.length || 0})
              </p>
              {pdp.individuals?.length === 0 ? (
                <p className="text-xs text-slate-400">No one assigned yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-1.5">Name</th>
                        <th className="text-left font-medium px-3 py-1.5">Responsibility / role</th>
                        <th className="text-left font-medium px-3 py-1.5">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pdp.individuals.map((row, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 font-medium text-navy-900">{row.name || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-700">{row.responsibility || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-600">{row.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-navy-900 mb-1.5">Milestones</p>
              {pdp.milestones?.length === 0 ? (
                <p className="text-xs text-slate-400">No milestones yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {pdp.milestones.map((m, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200">
                      <span className={`text-sm ${m.done ? 'text-slate-400 line-through' : 'text-navy-900'}`}>{m.label}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">
                        {formatDate(m.date)}{m.done ? ' · done' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {pdp.notes && (
              <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">PDP notes</p>
                <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{pdp.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* FDP — hidden until the user opens it */}
        {tab === 'fdp' && (
          <div className="space-y-3">
            {!showFdp ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
                <p className="text-sm font-medium text-slate-600">Financial Development Plan</p>
                <p className="text-xs text-slate-500 mt-1 mb-3">
                  Costing and pricing details are kept separate. Open to reveal.
                </p>
                <Button variant="secondary" onClick={() => setShowFdp(true)}>🔓 Open FDP</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <MetaRow label="Currency">{fdp.currency || '—'}</MetaRow>
                  <MetaRow label="Pricing model">{fdp.pricingModel || '—'}</MetaRow>
                  <MetaRow label="Estimated cost">{formatMoney(fdp.estimatedCost)}</MetaRow>
                  <MetaRow label="Proposed price">{formatMoney(fdp.proposedPrice)}</MetaRow>
                  <MetaRow label="Target margin %">{fdp.marginPct ? `${fdp.marginPct}%` : '—'}</MetaRow>
                  {fdp.assumptions && <MetaRow label="Assumptions">{fdp.assumptions}</MetaRow>}
                </div>
                {fdp.notes && (
                  <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">FDP notes</p>
                    <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{fdp.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TenderDetailModal;
