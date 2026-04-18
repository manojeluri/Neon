import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

const PRIORITIES = ['must', 'should', 'could'];
const ENERGIES   = ['deep', 'light', 'errand', 'recovery'];
const CONTEXTS   = ['anywhere', 'computer', 'phone', 'errands', 'home', 'office'];
const BLOCK_TYPES = [
  { value: '',           label: 'None' },
  { value: 'deep_work',  label: 'Deep work' },
  { value: 'admin',      label: 'Admin' },
  { value: 'calls',      label: 'Calls' },
  { value: 'exercise',   label: 'Exercise' },
  { value: 'reading',    label: 'Reading' },
  { value: 'buffer',     label: 'Buffer' },
];

export default function TaskForm({
  initialValues,
  onSave,
  onCancel,
  defaultDate,
  defaultListType,
  defaultContext,
  projects = [],
}) {
  const [title,         setTitle]         = useState(initialValues?.title         || '');
  const [priority,      setPriority]      = useState(initialValues?.priority      || 'should');
  const [date,          setDate]          = useState(initialValues?.date          || defaultDate || '');
  const [showMore,      setShowMore]      = useState(!!initialValues); // expanded when editing

  // "More options" fields
  const [description,   setDescription]   = useState(initialValues?.description   || '');
  const [time,          setTime]          = useState(initialValues?.time           || '');
  const [energy,        setEnergy]        = useState(initialValues?.energy         || 'light');
  const [context,       setContext]       = useState(initialValues?.context        || defaultContext || 'anywhere');
  const [listType,      setListType]      = useState(initialValues?.list_type     || defaultListType || 'active');
  const [waitingFor,    setWaitingFor]    = useState(initialValues?.waiting_for   || '');
  const [projectId,     setProjectId]     = useState(initialValues?.project_id    || '');
  const [blockType,     setBlockType]     = useState(initialValues?.block_type    || '');
  const [estMinutes,    setEstMinutes]    = useState(initialValues?.est_minutes   || '');
  const [actualMinutes, setActualMinutes] = useState(initialValues?.actual_minutes || '');

  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const titleRef = useRef(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  const est = parseInt(estMinutes, 10);
  const showTwoMin = est > 0 && est <= 2 && listType === 'active';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) { setError('Title is required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSave({
        title:          trimmed,
        description:    description.trim()  || null,
        date:           date                || null,
        time:           time                || null,
        priority,
        energy,
        block_type:     blockType           || null,
        est_minutes:    estMinutes   ? parseInt(estMinutes,    10) : null,
        actual_minutes: actualMinutes ? parseInt(actualMinutes, 10) : null,
        context,
        project_id:     projectId           || null,
        list_type:      listType,
        waiting_for:    listType === 'waiting' ? (waitingFor.trim() || null) : null,
      });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const activeProjects = projects.filter((p) => p.status === 'active');

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>

      {/* ── Always visible: Title ── */}
      <div className="form-group">
        <input
          ref={titleRef}
          id="tf-title"
          type="text"
          className="task-form-title-input"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(''); }}
          placeholder="What needs to get done?"
          maxLength={120}
          autoComplete="off"
        />
        {error && <div className="form-error">{error}</div>}
      </div>

      {showTwoMin && (
        <div className="two-min-rule">
          <Zap size={11} />
          <span>Two-minute rule — quick enough to do right now.</span>
        </div>
      )}

      {/* ── Always visible: Priority + Date ── */}
      <div className="task-form-inline-row">
        <div className="form-group task-form-group--priority">
          <label>Priority</label>
          <div className="pill-group">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`pill pill-priority-${p}${priority === p ? ' pill--active' : ''}`}
                onClick={() => setPriority(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group task-form-group--date">
          <label htmlFor="tf-date">Date</label>
          <input id="tf-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {/* ── More options toggle ── */}
      <button
        type="button"
        className="task-form-more-toggle"
        onClick={() => setShowMore((v) => !v)}
      >
        {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showMore ? 'Fewer options' : 'More options'}
      </button>

      {showMore && (
        <div className="task-form-more">

          {/* Energy + Context */}
          <div className="task-form-row">
            <div className="form-group">
              <label>Energy</label>
              <div className="pill-group">
                {ENERGIES.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`pill pill-energy-${e}${energy === e ? ' pill--active' : ''}`}
                    onClick={() => setEnergy(e)}
                  >
                    {e.charAt(0).toUpperCase() + e.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="task-form-row">
            <div className="form-group">
              <label>Context</label>
              <div className="pill-group">
                {CONTEXTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`pill${context === c ? ' pill--active pill-energy-deep' : ''}`}
                    onClick={() => setContext(c)}
                  >
                    @{c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List type */}
          <div className="task-form-row">
            <div className="form-group">
              <label>List</label>
              <div className="pill-group">
                {[
                  { value: 'active',  label: 'Active' },
                  { value: 'waiting', label: 'Waiting' },
                  { value: 'someday', label: 'Someday' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`pill${listType === value ? ' pill--active pill-energy-deep' : ''}`}
                    onClick={() => setListType(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {listType === 'waiting' && (
            <div className="task-form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="tf-waiting">Waiting for</label>
                <input
                  id="tf-waiting"
                  type="text"
                  value={waitingFor}
                  onChange={(e) => setWaitingFor(e.target.value)}
                  placeholder="Who or what are you waiting on?"
                  maxLength={120}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {/* Time + Est */}
          <div className="task-form-row">
            <div className="form-group">
              <label htmlFor="tf-time">Time</label>
              <input id="tf-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="tf-est">Est. (min)</label>
              <input
                id="tf-est"
                type="number"
                value={estMinutes}
                onChange={(e) => setEstMinutes(e.target.value)}
                placeholder="e.g. 45"
                min={1} max={480}
                style={{ width: '80px' }}
              />
            </div>
            {initialValues && (
              <div className="form-group">
                <label htmlFor="tf-actual">Actual (min)</label>
                <input
                  id="tf-actual"
                  type="number"
                  value={actualMinutes}
                  onChange={(e) => setActualMinutes(e.target.value)}
                  placeholder="e.g. 60"
                  min={1} max={480}
                  style={{ width: '80px' }}
                />
              </div>
            )}
          </div>

          {/* Block type + Project + Note */}
          <div className="task-form-row">
            <div className="form-group">
              <label htmlFor="tf-block">Block type</label>
              <select id="tf-block" value={blockType} onChange={(e) => setBlockType(e.target.value)}>
                {BLOCK_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            {activeProjects.length > 0 && (
              <div className="form-group">
                <label htmlFor="tf-project">Project</label>
                <select id="tf-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">— None —</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-group" style={{ flex: 2 }}>
              <label htmlFor="tf-desc">Note</label>
              <input
                id="tf-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details"
                maxLength={200}
                autoComplete="off"
              />
            </div>
          </div>

        </div>
      )}

      <div className="task-form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-submit" disabled={submitting || !title.trim()}>
          {submitting ? 'Saving…' : initialValues ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  );
}
