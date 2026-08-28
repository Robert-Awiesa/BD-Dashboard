import { useState, useEffect } from 'react';
import { bdApi } from '../../context/services/api';
import TrainingTab from './components/TrainingTab';
import CertificationTab from './components/CertificationTab';
import TrainingScheduleTab from './components/TrainingScheduleTab';
import TrainingFormModal from './components/TrainingFormModal';
import CertificationFormModal from './components/CertificationFormModal';
import TrainingScheduleFormModal from './components/TrainingScheduleFormModal';

const TrainingModule = () => {
  const [activeTab, setActiveTab] = useState('Trainings'); // 'Trainings' | 'Schedules' | 'Certifications'
  
  // Data states
  const [trainings, setTrainings] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [scheduleStats, setScheduleStats] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());

  // Modal states
  const [trainingModalOpen, setTrainingModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const [editingTraining, setEditingTraining] = useState(null);
  const [editingCert, setEditingCert] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleDefaultDate, setScheduleDefaultDate] = useState(null);

  const [trainingInitialType, setTrainingInitialType] = useState('Internal');
  const [scheduleConversionSource, setScheduleConversionSource] = useState(null);

  // Single source of truth for refreshing all training data
  const refreshAll = async () => {
    try {
      const [trainingsData, schedulesData, statsData] = await Promise.all([
        bdApi.getTrainings(),
        // No year filter here — the calendar component filters by month locally.
        // A year filter on the fetch would hide auto-created schedule entries
        // whose targetYear doesn't match the selected calendar year.
        bdApi.getTrainingSchedules(),
        bdApi.getTrainingScheduleStats(year),
      ]);
      setTrainings(trainingsData || []);
      setSchedules(schedulesData || []);
      setScheduleStats(statsData || null);
    } catch (err) {
      console.error('Error refreshing training data:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trainingsData, certsData, schedulesData, statsData] = await Promise.all([
        bdApi.getTrainings(),
        bdApi.getCertifications(),
        bdApi.getTrainingSchedules(),
        bdApi.getTrainingScheduleStats(year),
      ]);
      setTrainings(trainingsData || []);
      setCertifications(certsData || []);
      setSchedules(schedulesData || []);
      setScheduleStats(statsData || null);
    } catch (err) {
      console.error('Failed to load training & certification data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  // Quick action: Change status
  const handleQuickTrainingStatus = async (id, status) => {
    try {
      const updated = await bdApi.updateTraining(id, { progress: status });
      setTrainings((prev) => prev.map((t) => (t._id === id ? updated : t)));
    } catch (err) {
      alert(`Error updating training status: ${err.message}`);
    }
  };

  const handleQuickCertStatus = async (id, status) => {
    try {
      const updated = await bdApi.updateCertification(id, { progress: status });
      setCertifications((prev) => prev.map((c) => (c._id === id ? updated : c)));
    } catch (err) {
      alert(`Error updating certification status: ${err.message}`);
    }
  };

  // Delete handlers
  const handleDeleteTraining = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.title}"?`)) return;
    try {
      await bdApi.deleteTraining(item._id);
      // Optimistically remove from both lists, then confirm with a server refresh
      setTrainings((prev) => prev.filter((t) => t._id !== item._id));
      setSchedules((prev) => prev.filter((s) => String(s.convertedTrainingId) !== String(item._id)));
      // Refresh to confirm server state is in sync
      refreshAll();
    } catch (err) {
      alert(`Error deleting training: ${err.message}`);
    }
  };

  const handleDeleteCert = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.title}" (${item.candidate})?`))
      return;
    try {
      await bdApi.deleteCertification(item._id);
      setCertifications((prev) => prev.filter((c) => c._id !== item._id));
    } catch (err) {
      alert(`Error deleting certification: ${err.message}`);
    }
  };

  const handleDeleteSchedule = async (item) => {
    if (!window.confirm(`Are you sure you want to delete scheduled roadmap "${item.title}"?`))
      return;
    try {
      await bdApi.deleteTrainingSchedule(item._id);
      setSchedules((prev) => prev.filter((s) => s._id !== item._id));
      const newStats = await bdApi.getTrainingScheduleStats(year);
      setScheduleStats(newStats);
    } catch (err) {
      alert(`Error deleting schedule: ${err.message}`);
    }
  };

  // Open modal helpers
  const handleOpenCreateTraining = (type = 'Internal') => {
    setEditingTraining(null);
    setScheduleConversionSource(null);
    setTrainingInitialType(type);
    setTrainingModalOpen(true);
  };

  const handleOpenEditTraining = (item) => {
    setEditingTraining(item);
    setScheduleConversionSource(null);
    setTrainingInitialType(item.type);
    setTrainingModalOpen(true);
  };

  const handleOpenCreateCert = () => {
    setEditingCert(null);
    setCertModalOpen(true);
  };

  const handleOpenEditCert = (item) => {
    setEditingCert(item);
    setCertModalOpen(true);
  };

  const handleOpenCreateSchedule = (defaultDate = null) => {
    setEditingSchedule(null);
    setScheduleDefaultDate(defaultDate);
    setScheduleModalOpen(true);
  };

  const handleOpenEditSchedule = (item) => {
    setEditingSchedule(item);
    setScheduleDefaultDate(null);
    setScheduleModalOpen(true);
  };

  // 🚀 Conversion Workflow: Schedule -> Live Training
  const handleLaunchScheduleAsTraining = (scheduleItem) => {
    setEditingTraining(null);
    setScheduleConversionSource(scheduleItem);
    setTrainingInitialType(scheduleItem.targetType || 'Internal');
    setTrainingModalOpen(true);
  };

  // Saved callbacks — always sync from server to keep calendar real-time
  const handleTrainingSaved = async (saved) => {
    // Optimistically update trainings list immediately
    setTrainings((prev) => {
      const idx = prev.findIndex((t) => t._id === saved._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    // Then re-fetch both trainings + schedules so the auto-created calendar
    // entry for this training appears immediately on the Schedules tab.
    refreshAll();
  };

  const handleCertSaved = (saved) => {
    setCertifications((prev) => {
      const idx = prev.findIndex((c) => c._id === saved._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleScheduleSaved = (saved) => {
    // Optimistically update local list
    setSchedules((prev) => {
      const idx = prev.findIndex((s) => s._id === saved._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    // Sync stats
    bdApi.getTrainingScheduleStats(year).then(setScheduleStats).catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* Header & Master Tabs Switch */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-950 tracking-tight">
            Trainings & Certifications
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise capability matrix, staff credentials (SAP, AWS, Esri, OpenText), and upskilling roadmaps.
          </p>
        </div>

        {/* Master 3-Tab Switch */}
        <div className="flex flex-wrap bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs w-fit">
          <button
            onClick={() => setActiveTab('Trainings')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === 'Trainings'
                ? 'bg-white text-navy-950 shadow-sm border border-slate-200/70'
                : 'text-slate-600 hover:text-navy-900 hover:bg-slate-200/40'
            }`}
          >
            <span>🎓</span>
            <span>Active Pipeline</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
              {trainings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Schedules')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === 'Schedules'
                ? 'bg-white text-navy-950 shadow-sm border border-slate-200/70'
                : 'text-slate-600 hover:text-navy-900 hover:bg-slate-200/40'
            }`}
          >
            <span>📅</span>
            <span>Schedules & Calendar</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
              {schedules.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('Certifications')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === 'Certifications'
                ? 'bg-white text-navy-950 shadow-sm border border-slate-200/70'
                : 'text-slate-600 hover:text-navy-900 hover:bg-slate-200/40'
            }`}
          >
            <span>🛡️</span>
            <span>Certifications Matrix</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-bold">
              {certifications.length}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-center justify-between">
          <span>Failed to sync with database: {error}</span>
          <button
            onClick={fetchData}
            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 rounded-lg font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="mt-4">
        {activeTab === 'Trainings' ? (
          <TrainingTab
            trainings={trainings}
            loading={loading}
            onEdit={handleOpenEditTraining}
            onDelete={handleDeleteTraining}
            onOpenCreate={handleOpenCreateTraining}
            onQuickStatus={handleQuickTrainingStatus}
          />
        ) : activeTab === 'Schedules' ? (
          <TrainingScheduleTab
            schedules={schedules}
            trainings={trainings}
            stats={scheduleStats}
            loading={loading}
            year={year}
            setYear={setYear}
            onEdit={handleOpenEditSchedule}
            onDelete={handleDeleteSchedule}
            onOpenCreate={handleOpenCreateSchedule}
            onLaunchTraining={handleLaunchScheduleAsTraining}
            onEditTraining={handleOpenEditTraining}
          />
        ) : (
          <CertificationTab
            certs={certifications}
            loading={loading}
            onEdit={handleOpenEditCert}
            onDelete={handleDeleteCert}
            onOpenCreate={handleOpenCreateCert}
            onQuickStatus={handleQuickCertStatus}
          />
        )}
      </div>

      {/* Modals */}
      <TrainingFormModal
        open={trainingModalOpen}
        onClose={() => {
          setTrainingModalOpen(false);
          setScheduleConversionSource(null);
        }}
        onSaved={handleTrainingSaved}
        existing={editingTraining}
        initialType={trainingInitialType}
        fromSchedule={scheduleConversionSource}
        availableSchedules={schedules}
      />

      <CertificationFormModal
        open={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        onSaved={handleCertSaved}
        existing={editingCert}
      />

      <TrainingScheduleFormModal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        onSaved={handleScheduleSaved}
        existing={editingSchedule}
        defaultDate={scheduleDefaultDate}
      />
    </div>
  );
};

export default TrainingModule;