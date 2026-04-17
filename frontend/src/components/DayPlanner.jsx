import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(timeStr) {
  if (!timeStr) return 'All day';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Task item row
function TaskItem({ task, onToggle, onEdit, onDelete }) {
  return (
    <div className={`task-item${task.completed ? ' task-item--done' : ''}`}>
      <div className="task-time-col">
        <span className="task-time-label">{formatTime(task.time)}</span>
      </div>
      <div className="task-body">
        <div className="task-main">
          <button
            className={`btn-toggle btn-toggle--sm${task.completed ? ' checked' : ''}`}
            onClick={onToggle}
            title={task.completed ? 'Mark incomplete' : 'Mark complete'}
            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          >
            <span className="check-icon">✓</span>
          </button>
          <div className="task-text">
            <span className="task-title">{task.title}</span>
            {task.description && (
              <span className="task-description">{task.description}</span>
            )}
          </div>
          <div className="task-actions">
            <button className="btn-task-action" onClick={onEdit} title="Edit task" aria-label="Edit task">
              ✎
            </button>
            <button className="btn-task-action btn-task-action--delete" onClick={onDelete} title="Delete task" aria-label="Delete task">
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline task form (add or edit)
function TaskForm({ initialValues, onSave, onCancel, selectedDate }) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [date, setDate] = useState(initialValues?.date || selectedDate);
  const [time, setTime] = useState(initialValues?.time || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) { setError('Title is required.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSave({ title: trimmed, description: description.trim(), date, time: time || null });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate>
      <div className="task-form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="tf-title">Title *</label>
          <input
            ref={titleRef}
            id="tf-title"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            placeholder="Task title"
            maxLength={120}
            autoComplete="off"
          />
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="tf-time">Time (optional)</label>
          <input
            id="tf-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <div className="task-form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label htmlFor="tf-desc">Description</label>
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
        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="tf-date">Date</label>
          <input
            id="tf-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="task-form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn-submit" disabled={submitting || !title.trim()}>
          {submitting ? 'Saving...' : initialValues ? 'Save Changes' : 'Add Task'}
        </button>
      </div>
    </form>
  );
}

export default function DayPlanner({ selectedDate, onSelectDate }) {
  const today = getTodayStr();
  const date = selectedDate || today;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const tasksRes = await fetch(`/api/tasks?date=${date}`);
      setTasks(await tasksRes.json());
    } catch (err) {
      console.error('DayPlanner fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
    // Reset form state when date changes
    setShowAddTask(false);
    setEditingTask(null);
  }, [fetchData]);



  // Task toggle
  const handleTaskToggle = async (task) => {
    const newCompleted = !task.completed;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: newCompleted ? 1 : 0 } : t));
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
    } catch (err) {
      console.error('Failed to toggle task:', err);
      fetchData();
    }
  };

  // Add task
  const handleAddTask = async (fields) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Failed to create task');
    }
    const newTask = await res.json();
    // If task date differs from selected date, don't add to list (just close)
    if (newTask.date === date) {
      setTasks((prev) => {
        const updated = [...prev, newTask];
        return updated.sort((a, b) => {
          const aTime = a.time || 'zzz';
          const bTime = b.time || 'zzz';
          return aTime.localeCompare(bTime);
        });
      });
    }
    setShowAddTask(false);
  };

  // Edit task save
  const handleEditTask = async (fields) => {
    const res = await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Failed to update task');
    }
    const updated = await res.json();
    if (updated.date === date) {
      setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t).sort((a, b) => {
        const aTime = a.time || 'zzz';
        const bTime = b.time || 'zzz';
        return aTime.localeCompare(bTime);
      }));
    } else {
      // Task moved to a different date — remove from current view
      setTasks((prev) => prev.filter((t) => t.id !== updated.id));
    }
    setEditingTask(null);
  };

  // Delete task
  const handleDeleteTask = (taskId) => {
    setConfirm({
      message: 'Delete this task?',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
          setTasks((prev) => prev.filter((t) => t.id !== taskId));
        } catch (err) {
          console.error('Failed to delete task:', err);
        }
      },
    });
  };

  const isToday = date === today;

  return (
    <div className="day-planner">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {/* Date header */}
      <div className="planner-header">
        <button
          className="planner-nav-btn"
          onClick={() => onSelectDate(addDays(date, -1))}
          aria-label="Previous day"
        >
          &#8249;
        </button>

        <div className="planner-date-group">
          <div className="planner-date-label">
            {formatDisplayDate(date)}
          </div>
          {isToday && <span className="planner-today-badge">Today</span>}
        </div>

        <button
          className="planner-nav-btn"
          onClick={() => onSelectDate(addDays(date, 1))}
          aria-label="Next day"
        >
          &#8250;
        </button>

        {!isToday && (
          <button
            className="btn-jump-today"
            onClick={() => onSelectDate(today)}
          >
            Jump to Today
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <div>Loading...</div>
        </div>
      ) : (
        <div className="planner-body">
          {/* Tasks section */}
          <section className="planner-section">
            <div className="planner-section-header">
              <h2 className="planner-section-title">Tasks</h2>
              {tasks.length > 0 && (
                <span className="planner-section-count">
                  {tasks.filter((t) => t.completed).length} / {tasks.length}
                </span>
              )}
            </div>

            {tasks.length === 0 && !showAddTask ? (
              <div className="planner-empty">No tasks for this day.</div>
            ) : (
              <div className="task-list">
                {tasks.map((task) =>
                  editingTask && editingTask.id === task.id ? (
                    <div key={task.id} className="task-form-wrapper">
                      <TaskForm
                        initialValues={editingTask}
                        selectedDate={date}
                        onSave={handleEditTask}
                        onCancel={() => setEditingTask(null)}
                      />
                    </div>
                  ) : (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={() => handleTaskToggle(task)}
                      onEdit={() => { setEditingTask(task); setShowAddTask(false); }}
                      onDelete={() => handleDeleteTask(task.id)}
                    />
                  )
                )}
              </div>
            )}

            {showAddTask && !editingTask && (
              <div className="task-form-wrapper">
                <TaskForm
                  selectedDate={date}
                  onSave={handleAddTask}
                  onCancel={() => setShowAddTask(false)}
                />
              </div>
            )}

            {!showAddTask && !editingTask && (
              <button
                className="btn-add-task"
                onClick={() => setShowAddTask(true)}
              >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span>
                Add Task
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
