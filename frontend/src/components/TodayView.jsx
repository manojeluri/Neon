import { API } from '../api';
import React, { useState, useEffect, useCallback } from 'react';
import TaskForm from './TaskForm.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTomorrow(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatWeekday(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// ─── Priority Item (inside command card) ──────────────────────────────────────

function PriorityItem({ task, index, nowTaskId, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const isNow = task.id === nowTaskId || task.is_now === 1;

  if (editing) {
    return (
      <div className="p-edit-wrap">
        <TaskForm
          initialValues={task}
          onSave={async (fields) => { await onUpdate(task.id, fields); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={`p-item${task.completed ? ' p-item--done' : ''}${isNow ? ' p-item--now' : ''}`}>
      <span className="p-item-idx">{String(index + 1).padStart(2, '0')}</span>

      <button
        className={`p-item-check${task.completed ? ' checked' : ''}`}
        onClick={onToggle}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>

      <span className="p-item-title">{task.title}</span>

      <div className="p-item-end">
        {task.priority === 'must' && <span className="p-must-dot" title="Must" />}
        {task.est_minutes && <span className="p-item-est">{task.est_minutes}m</span>}
        <div className="p-item-actions">
          <button
            className={`p-action${isNow ? ' p-action--active' : ''}`}
            onClick={() => onUpdate(task.id, { is_now: isNow ? 0 : 1 })}
            title={isNow ? 'Clear focus' : 'Set as focus'}
          >▶</button>
          <button className="p-action" onClick={() => setEditing(true)} title="Edit">✎</button>
          <button className="p-action p-action--del" onClick={onDelete} title="Delete">✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── Simple Row (secondary list) ──────────────────────────────────────────────

function SimpleRow({ task, nowTaskId, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const isNow = task.id === nowTaskId;

  if (editing) {
    return (
      <div className="s-edit-wrap">
        <TaskForm
          initialValues={task}
          onSave={async (fields) => { await onUpdate(task.id, fields); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={`s-row${task.completed ? ' s-row--done' : ''}${isNow ? ' s-row--now' : ''}`}>
      <button
        className={`s-row-check${task.completed ? ' checked' : ''}`}
        onClick={onToggle}
      >
        {task.completed && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </button>

      <div className="s-row-body">
        <span className="s-row-title">{task.title}</span>
        <div className="s-row-chips">
          {formatTime(task.time) && <span className="s-chip s-chip--time">{formatTime(task.time)}</span>}
          {task.priority !== 'should' && (
            <span className={`s-chip priority-${task.priority}`}>{task.priority}</span>
          )}
          {task.energy && task.energy !== 'light' && (
            <span className={`s-chip energy-${task.energy}`}>{task.energy}</span>
          )}
          {task.est_minutes && <span className="s-chip s-chip--est">{task.est_minutes}m</span>}
        </div>
      </div>

      <div className="s-row-actions">
        <button
          className={`btn-icon${isNow ? ' btn-icon--now-active' : ''}`}
          onClick={() => onUpdate(task.id, { is_now: isNow ? 0 : 1 })}
          title="Set focus"
        >▶</button>
        <button
          className={`btn-icon${task.is_top3 ? ' btn-icon--top3-active' : ''}`}
          onClick={() => onUpdate(task.id, { is_top3: task.is_top3 ? 0 : 1 })}
          title="Add to Top 3"
        >★</button>
        <button className="btn-icon" onClick={() => setEditing(true)} title="Edit">✎</button>
        <button className="btn-icon btn-icon--danger" onClick={onDelete} title="Delete">✕</button>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function TodayView() {
  const today = getTodayStr();
  const [tasks, setTasks] = useState([]);
  const [nowTaskId, setNowTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickError, setQuickError] = useState('');
  const [confirm, setConfirm] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, nowRes] = await Promise.all([
        fetch(`${API}/api/tasks?date=${today}`),
        fetch(`${API}/api/tasks/now`),
      ]);
      const tasksData = await tasksRes.json();
      const nowData = await nowRes.json();
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setNowTaskId(nowData ? nowData.id : null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const updateTask = async (id, fields) => {
    try {
      const res = await fetch(`${API}/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Update failed'); return; }
      const updated = await res.json();
      if (fields.is_now !== undefined) {
        setNowTaskId(fields.is_now ? updated.id : null);
        setTasks(prev => prev.map(t => ({ ...t, is_now: t.id === updated.id ? (fields.is_now ? 1 : 0) : 0 })));
      } else {
        setTasks(prev => prev.map(t => t.id === id ? updated : t).sort((a, b) => {
          if (b.is_top3 !== a.is_top3) return b.is_top3 - a.is_top3;
          return (a.time || 'zzz').localeCompare(b.time || 'zzz');
        }));
      }
    } catch (err) { console.error(err); }
  };

  const toggleTask = async (task) => {
    const newCompleted = !task.completed;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted ? 1 : 0 } : t));
    try {
      await fetch(`${API}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
    } catch { fetchTasks(); }
  };

  const deleteTask = (id) => {
    setConfirm({
      message: 'Delete this task?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await fetch(`${API}/api/tasks/${id}`, { method: 'DELETE' });
        setTasks(prev => prev.filter(t => t.id !== id));
        if (id === nowTaskId) setNowTaskId(null);
      },
    });
  };

  const addTask = async (fields) => {
    const res = await fetch(`${API}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, date: today }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
    const newTask = await res.json();
    setTasks(prev => [...prev, newTask].sort((a, b) => {
      if (b.is_top3 !== a.is_top3) return b.is_top3 - a.is_top3;
      return (a.time || 'zzz').localeCompare(b.time || 'zzz');
    }));
    setShowAddForm(false);
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed, date: today, priority: 'should', energy: 'light' }),
      });
      if (!res.ok) { const d = await res.json(); setQuickError(d.error || 'Failed'); return; }
      const newTask = await res.json();
      setTasks(prev => [...prev, newTask]);
      setQuickTitle('');
      setQuickError('');
    } catch (err) { setQuickError(err.message); }
  };

  const carryUnfinished = () => {
    const unfinished = tasks.filter(t => !t.completed);
    if (!unfinished.length) return;
    setConfirm({
      message: `Move ${unfinished.length} unfinished task${unfinished.length !== 1 ? 's' : ''} to tomorrow?`,
      confirmLabel: 'Move',
      danger: false,
      onConfirm: async () => {
        setConfirm(null);
        const tomorrow = getTomorrow(today);
        await Promise.all(unfinished.map(t => fetch(`${API}/api/tasks/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: tomorrow, is_top3: 0 }),
        })));
        fetchTasks();
      },
    });
  };

  const nowTask = tasks.find(t => t.id === nowTaskId || t.is_now === 1) || null;
  const top3 = tasks.filter(t => t.is_top3);
  const rest = tasks.filter(t => !t.is_top3);
  const completedCount = tasks.filter(t => t.completed).length;
  const totalEst = tasks.reduce((s, t) => s + (t.est_minutes || 0), 0);
  const overplanned = totalEst > 8 * 60;
  const unfinishedCount = tasks.filter(t => !t.completed).length;

  return (
    <div className="today-view">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Command Card ── */}
      <div className="cmd-card">

        {/* Card header row */}
        <div className="cmd-header">
          <div className="cmd-dateline">
            <span className="cmd-weekday">{formatWeekday(today)}</span>
            <span className="cmd-sep">·</span>
            <span className="cmd-datestr">{formatShortDate(today)}</span>
          </div>
          <div className="cmd-header-right">
            {overplanned && (
              <span className="cmd-overplan-badge">
                {(totalEst / 60).toFixed(1)}h planned
              </span>
            )}
            {tasks.length > 0 && (
              <span className="cmd-progress-text">{completedCount}<span className="cmd-progress-of">/{tasks.length}</span></span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="cmd-loading"><div className="spinner" /></div>
        ) : (
          <>
            {/* ── Focus block ── */}
            <div className={`focus-block${nowTask ? ' focus-block--active' : ''}`}>
              <span className="focus-eyebrow">Focus</span>
              {nowTask ? (
                <div className="focus-live">
                  <div className="focus-task-name">{nowTask.title}</div>
                  <div className="focus-task-meta">
                    <span className={`priority-badge priority-${nowTask.priority || 'should'}`}>
                      {nowTask.priority || 'should'}
                    </span>
                    <span className={`energy-tag energy-${nowTask.energy || 'light'}`}>
                      {nowTask.energy || 'light'}
                    </span>
                    {nowTask.est_minutes && (
                      <span className="est-chip">{nowTask.est_minutes} min</span>
                    )}
                  </div>
                  <button
                    className="focus-clear"
                    onClick={() => updateTask(nowTask.id, { is_now: 0 })}
                  >
                    Clear focus
                  </button>
                </div>
              ) : (
                <div className="focus-idle">
                  <span className="focus-idle-symbol">◎</span>
                  <span className="focus-idle-text">Select a task to begin</span>
                </div>
              )}
            </div>

            {/* ── Top 3 ── */}
            <div className="priorities-block">
              <div className="priorities-header">
                <span className="priorities-eyebrow">Top 3</span>
                {top3.length > 0 && (
                  <span className="priorities-tally">
                    {top3.filter(t => t.completed).length} / {top3.length}
                  </span>
                )}
              </div>

              {top3.length === 0 ? (
                <div className="priorities-empty">
                  Press <span className="priorities-star">★</span> on a task to pin your priorities
                </div>
              ) : (
                <div className="priorities-list">
                  {top3.map((task, i) => (
                    <PriorityItem
                      key={task.id}
                      task={task}
                      index={i}
                      nowTaskId={nowTaskId}
                      onToggle={() => toggleTask(task)}
                      onUpdate={updateTask}
                      onDelete={() => deleteTask(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Add input ── */}
            <div className="cmd-add">
              {showAddForm ? (
                <TaskForm
                  defaultDate={today}
                  onSave={addTask}
                  onCancel={() => setShowAddForm(false)}
                />
              ) : (
                <>
                  <form onSubmit={handleQuickAdd} className="cmd-add-form">
                    <input
                      className="cmd-add-input"
                      type="text"
                      value={quickTitle}
                      onChange={e => { setQuickTitle(e.target.value); setQuickError(''); }}
                      placeholder="What needs to happen today…"
                      maxLength={120}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className="cmd-add-btn"
                      disabled={!quickTitle.trim()}
                      aria-label="Add task"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M5.5 1V10M1 5.5H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </form>
                  <button
                    type="button"
                    className="cmd-add-more"
                    onClick={() => setShowAddForm(true)}
                  >
                    More options
                  </button>
                  {quickError && <div className="form-error">{quickError}</div>}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Secondary task list ── */}
      {rest.length > 0 && (
        <div className="today-rest">
          <div className="today-rest-header">
            <span>Remaining</span>
            <span>{rest.filter(t => t.completed).length} / {rest.length}</span>
          </div>
          <div className="today-rest-list">
            {rest.map(task => (
              <SimpleRow
                key={task.id}
                task={task}
                nowTaskId={nowTaskId}
                onToggle={() => toggleTask(task)}
                onUpdate={updateTask}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Carry action ── */}
      {unfinishedCount > 0 && (
        <button className="carry-footer-btn" onClick={carryUnfinished}>
          Move {unfinishedCount} unfinished to tomorrow
        </button>
      )}

    </div>
  );
}
