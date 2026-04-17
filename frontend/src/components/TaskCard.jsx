import React, { useState } from 'react';
import TaskForm from './TaskForm.jsx';

const PRIORITY_LABELS = { must: 'Must', should: 'Should', could: 'Could' };
const ENERGY_LABELS = { deep: 'Deep', light: 'Light', errand: 'Errand', recovery: 'Recovery' };

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function TaskCard({ task, onToggle, onUpdate, onDelete, nowTaskId, showDate }) {
  const [editing, setEditing] = useState(false);

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

  return (
    <div className={`task-card${task.completed ? ' task-card--done' : ''}${isNow ? ' task-card--now' : ''}${task.list_type === 'waiting' ? ' task-card--waiting' : ''}`}>
      <button
        className={`btn-toggle btn-toggle--sm${task.completed ? ' checked' : ''}`}
        onClick={onToggle}
        title={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        <span className="check-icon">✓</span>
      </button>

      <div className="task-card-body">
        <div className="task-card-top">
          <span className="task-card-title">{task.title}</span>
          <div className="task-card-meta">
            {time && <span className="task-time-chip">{time}</span>}
            {showDate && task.date && <span className="task-date-chip">{task.date}</span>}
            {task.context && task.context !== 'anywhere' && (
              <span className="context-badge">@{task.context}</span>
            )}
            {task.project_title && (
              <span className="project-badge">{task.project_title}</span>
            )}
            <span className={`priority-badge priority-${task.priority || 'should'}`}>
              {PRIORITY_LABELS[task.priority] || 'Should'}
            </span>
            <span className={`energy-tag energy-${task.energy || 'light'}`}>
              {ENERGY_LABELS[task.energy] || 'Light'}
            </span>
            {task.est_minutes && (
              <span className="est-chip">{task.est_minutes}m</span>
            )}
          </div>
        </div>
        {task.waiting_for && (
          <span className="task-waiting-for">Waiting: {task.waiting_for}</span>
        )}
        {task.description && (
          <span className="task-card-desc">{task.description}</span>
        )}
      </div>

      <div className="task-card-actions">
        <button
          className={`btn-icon${isNow ? ' btn-icon--now-active' : ''}`}
          onClick={() => onUpdate(task.id, { is_now: isNow ? 0 : 1 })}
          title={isNow ? 'Clear focus' : 'Set as Now'}
        >▶</button>
        <button
          className={`btn-icon${task.is_top3 ? ' btn-icon--top3-active' : ''}`}
          onClick={() => onUpdate(task.id, { is_top3: task.is_top3 ? 0 : 1 })}
          title={task.is_top3 ? 'Remove from Top 3' : 'Add to Top 3'}
        >★</button>
        <button className="btn-icon" onClick={() => setEditing(true)} title="Edit">✎</button>
        <button className="btn-icon btn-icon--danger" onClick={onDelete} title="Delete">✕</button>
      </div>
    </div>
  );
}
