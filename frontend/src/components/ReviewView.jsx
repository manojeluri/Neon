import React, { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CarryTask({ task, onCarry, onArchive, onDelete }) {
  return (
    <div className="carry-task-row">
      <span className="carry-task-title">{task.title}</span>
      <div className="carry-task-actions">
        <button className="btn-carry-action btn-carry-action--tomorrow" onClick={onCarry}>
          Tomorrow
        </button>
        <button className="btn-carry-action btn-carry-action--archive" onClick={onArchive}>
          Archive
        </button>
        <button className="btn-carry-action btn-carry-action--delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ReviewView() {
  const today = getTodayStr();
  const tomorrow = addDays(today, 1);

  const [todayTasks, setTodayTasks] = useState([]);
  const [tomorrowTasks, setTomorrowTasks] = useState([]);
  const [review, setReview] = useState({ got_done: '', slipped: '', wasted_time: '' });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, tomorrowRes, reviewRes] = await Promise.all([
        fetch(`/api/tasks?date=${today}`),
        fetch(`/api/tasks?date=${tomorrow}`),
        fetch(`/api/review?date=${today}`),
      ]);
      const todayData = await todayRes.json();
      const tomorrowData = await tomorrowRes.json();
      const reviewData = await reviewRes.json();
      setTodayTasks(Array.isArray(todayData) ? todayData : []);
      setTomorrowTasks(Array.isArray(tomorrowData) ? tomorrowData : []);
      setReview({
        got_done: reviewData.got_done || '',
        slipped: reviewData.slipped || '',
        wasted_time: reviewData.wasted_time || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [today, tomorrow]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const unfinished = todayTasks.filter((t) => !t.completed);
  const completed = todayTasks.filter((t) => t.completed);

  const carryTask = async (task) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: tomorrow, is_top3: 0 }),
    });
    setTodayTasks((prev) => prev.filter((t) => t.id !== task.id));
    fetchData(); // refresh tomorrow list
  };

  const archiveTask = async (task) => {
    // Archive = complete without carrying
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    });
    setTodayTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: 1 } : t));
  };

  const deleteTask = (task) => {
    setConfirm({
      message: 'Delete this task?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
        setTodayTasks((prev) => prev.filter((t) => t.id !== task.id));
      },
    });
  };

  const toggleTomorrowTop3 = async (task) => {
    const top3Count = tomorrowTasks.filter((t) => t.is_top3 && t.id !== task.id).length;
    if (!task.is_top3 && top3Count >= 3) {
      alert('Top 3 for tomorrow is full. Remove one first.');
      return;
    }
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_top3: task.is_top3 ? 0 : 1 }),
    });
    const updated = await res.json();
    setTomorrowTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  };

  const saveReview = async () => {
    setSaving(true);
    try {
      await fetch('/api/review', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, ...review }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /><div>Loading…</div></div>;

  const tomorrowTop3 = tomorrowTasks.filter((t) => t.is_top3);

  return (
    <div className="review-view">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="review-header">
        <h2 className="review-title">End of Day Review</h2>
        <div className="review-date">{new Date(today + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Today's done */}
      {completed.length > 0 && (
        <section className="review-section">
          <div className="review-section-title">Completed today ({completed.length})</div>
          <div className="review-done-list">
            {completed.map((t) => (
              <div key={t.id} className="review-done-item">
                <span className="review-done-check">✓</span>
                <span>{t.title}</span>
                {t.actual_minutes && <span className="est-chip">{t.actual_minutes}m</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Unfinished tasks */}
      {unfinished.length > 0 && (
        <section className="review-section">
          <div className="review-section-title">Unfinished ({unfinished.length})</div>
          <div className="carry-task-list">
            {unfinished.map((task) => (
              <CarryTask
                key={task.id}
                task={task}
                onCarry={() => carryTask(task)}
                onArchive={() => archiveTask(task)}
                onDelete={() => deleteTask(task)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 3 review questions */}
      <section className="review-section">
        <div className="review-section-title">3 questions</div>

        <div className="review-question">
          <label>What got done?</label>
          <textarea
            value={review.got_done}
            onChange={(e) => setReview((r) => ({ ...r, got_done: e.target.value }))}
            placeholder="Tasks finished, things accomplished…"
            rows={3}
          />
        </div>

        <div className="review-question">
          <label>What slipped?</label>
          <textarea
            value={review.slipped}
            onChange={(e) => setReview((r) => ({ ...r, slipped: e.target.value }))}
            placeholder="What didn't happen that was planned…"
            rows={3}
          />
        </div>

        <div className="review-question">
          <label>What wasted time?</label>
          <textarea
            value={review.wasted_time}
            onChange={(e) => setReview((r) => ({ ...r, wasted_time: e.target.value }))}
            placeholder="Interruptions, distractions, rabbit holes…"
            rows={3}
          />
        </div>

        <button className="btn-submit" onClick={saveReview} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Review'}
        </button>
      </section>

      {/* Tomorrow's Top 3 */}
      <section className="review-section">
        <div className="review-section-title">
          Tomorrow's Top 3 ({tomorrowTop3.length} / 3)
        </div>
        {tomorrowTasks.length === 0 ? (
          <div className="planner-empty">No tasks for tomorrow yet. Add them in the Tasks tab.</div>
        ) : (
          <div className="tomorrow-top3-list">
            {tomorrowTasks.map((task) => (
              <div
                key={task.id}
                className={`tomorrow-task-row${task.is_top3 ? ' tomorrow-task-row--pinned' : ''}`}
              >
                <button
                  className={`btn-icon${task.is_top3 ? ' btn-icon--top3-active' : ''}`}
                  onClick={() => toggleTomorrowTop3(task)}
                  title={task.is_top3 ? 'Remove from Top 3' : 'Add to Top 3'}
                >★</button>
                <span className="tomorrow-task-title">{task.title}</span>
                <span className={`priority-badge priority-${task.priority || 'should'}`}>
                  {task.priority || 'should'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
