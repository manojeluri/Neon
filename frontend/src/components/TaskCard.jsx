import React, { useState } from 'react';
import { Play, Star, Pencil, Trash2, CalendarPlus } from 'lucide-react';
import TaskForm from './TaskForm.jsx';

const PRIORITY_LABELS = { must: 'Must', could: 'Could' }; // 'should' is default — no badge needed
const ENERGY_LABELS   = { deep: 'Deep', errand: 'Errand', recovery: 'Recovery' }; // 'light' is default

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function TaskCard({ task, onToggle, onUpdate, onDelete, nowTaskId, showDate }) {
  const [editing, setEditing] = useState(false);
  const today = getTodayStr();

  if (editing) {
    return (
      <div className="task-form-wrapper">
        <TaskForm
          initialValues={task}
          onSave={async (fields) => { await onUpdate(task.id, fields); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const isNow = task.id === nowTaskId || task.is_now === 1;
  const time = formatTime(task.time);

  // Only show badges that carry signal — hide defaults ('should', 'light', 'anywhere')
  const showPriority = task.priority && task.priority !== 'should';
  const showEnergy   = task.energy   && task.energy   !== 'light';
  const showContext  = task.context  && task.context  !== 'anywhere';

  return (
    <div className={`task-card${task.completed ? ' task-card--done' : ''}${isNow ? ' task-card--now' : ''}${task.list_type === 'waiting' ? ' task-card--waiting' : ''}`}>
      <button
        className={`btn-toggle btn-toggle--sm${task.completed ? ' checked' : ''}`}
        onClick={onToggle}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        <span className="check-icon">✓</span>
      </button>

      <div className="task-card-body">
        <span className="task-card-title">{task.title}</span>

        {/* Meta row — only rendered if there's something to show */}
        {(time || (showDate && task.date) || showPriority || showEnergy || showContext || task.project_title || task.est_minutes || task.waiting_for || task.description) && (
          <div className="task-card-meta">
            {time && <span className="task-time-chip">{time}</span>}
            {showDate && task.date && <span className="task-date-chip">{formatDate(task.date)}</span>}
            {showPriority && (
              <span className={`priority-badge priority-${task.priority}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            {showEnergy && (
              <span className={`energy-tag energy-${task.energy}`}>
                {ENERGY_LABELS[task.energy]}
              </span>
            )}
            {showContext && <span className="context-badge">@{task.context}</span>}
            {task.project_title && <span className="project-badge">{task.project_title}</span>}
            {task.est_minutes && <span className="est-chip">{task.est_minutes}m</span>}
            {task.waiting_for && <span className="task-waiting-chip">↷ {task.waiting_for}</span>}
            {task.description && <span className="task-card-desc">{task.description}</span>}
          </div>
        )}
      </div>

      <div className="task-card-actions">
        <button
          className={`btn-icon${isNow ? ' btn-icon--now-active' : ''}`}
          onClick={() => onUpdate(task.id, { is_now: isNow ? 0 : 1 })}
          title={isNow ? 'Clear focus' : 'Focus now'}
        >
          <Play size={11} />
        </button>
        <button
          className={`btn-icon${task.is_top3 ? ' btn-icon--top3-active' : ''}`}
          onClick={() => onUpdate(task.id, { is_top3: task.is_top3 ? 0 : 1 })}
          title={task.is_top3 ? 'Remove from Top 3' : 'Add to Top 3'}
        >
          <Star size={11} />
        </button>
        {task.date !== today && (
          <button
            className="btn-icon"
            onClick={() => onUpdate(task.id, { date: today, list_type: 'active' })}
            title="Schedule for today"
          >
            <CalendarPlus size={11} />
          </button>
        )}
        <button className="btn-icon" onClick={() => setEditing(true)} title="Edit">
          <Pencil size={11} />
        </button>
        <button className="btn-icon btn-icon--danger" onClick={onDelete} title="Delete">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
