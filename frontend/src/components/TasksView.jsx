import { API } from '../api';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import TaskCard from './TaskCard.jsx';
import TaskForm from './TaskForm.jsx';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SUBTABS = [
  { id: 'inbox',    label: 'Unscheduled' },
  { id: 'today',    label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'later',    label: 'Later' },
  { id: 'waiting',  label: 'Waiting For' },
  { id: 'someday',  label: 'Someday' },
  { id: 'contexts', label: 'Contexts' },
];

const CONTEXTS = ['anywhere', 'computer', 'phone', 'errands', 'home', 'office'];

export default function TasksView({ refreshKey = 0 }) {
  const today = getTodayStr();
  const tomorrow = addDays(today, 1);

  const [subtab, setSubtab] = useState('inbox');
  const [tasks, setTasks] = useState([]);
  const [nowTaskId, setNowTaskId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeContext, setActiveContext] = useState('anywhere');
  const [projects, setProjects] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const cacheRef = useRef({});

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects`);
      setProjects(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const fetchTasks = useCallback(async () => {
    const cacheKey = subtab === 'contexts' ? `contexts:${activeContext}` : subtab;
    const cached = cacheRef.current[cacheKey];

    // Show cached data instantly, skip spinner
    if (cached) {
      setTasks(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      let url;
      if (subtab === 'inbox')         url = `${API}/api/tasks/inbox`;
      else if (subtab === 'today')    url = `${API}/api/tasks?date=${today}`;
      else if (subtab === 'tomorrow') url = `${API}/api/tasks?date=${tomorrow}`;
      else if (subtab === 'later')    url = `${API}/api/tasks/later?after=${tomorrow}`;
      else if (subtab === 'waiting')  url = `${API}/api/tasks/waiting`;
      else if (subtab === 'someday')  url = `${API}/api/tasks/someday`;
      else if (subtab === 'contexts') url = `${API}/api/tasks/contexts?context=${activeContext}`;

      const [tasksRes, nowRes] = await Promise.all([
        fetch(url),
        fetch(`${API}/api/tasks/now`),
      ]);
      const tasksData = await tasksRes.json();
      const nowData = await nowRes.json();
      const data = Array.isArray(tasksData) ? tasksData : [];
      cacheRef.current[cacheKey] = data;
      setTasks(data);
      setNowTaskId(nowData ? nowData.id : null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [subtab, today, tomorrow, activeContext]);

  useEffect(() => {
    fetchTasks();
    setShowAddForm(false);
  }, [fetchTasks]);

  // External refresh (e.g. task created from Inbox) — clear cache and refetch
  useEffect(() => {
    if (refreshKey === 0) return;
    cacheRef.current = {};
    fetchTasks();
  }, [refreshKey]);

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
        setTasks((prev) => prev.map((t) => ({ ...t, is_now: t.id === updated.id ? (fields.is_now ? 1 : 0) : 0 })));
      } else {
        const stillBelongs = (() => {
          if (subtab === 'inbox')    return !updated.date && updated.list_type === 'active';
          if (subtab === 'today')    return updated.date === today;
          if (subtab === 'tomorrow') return updated.date === tomorrow;
          if (subtab === 'later')    return updated.date > tomorrow;
          if (subtab === 'waiting')  return updated.list_type === 'waiting';
          if (subtab === 'someday')  return updated.list_type === 'someday';
          if (subtab === 'contexts') return updated.context === activeContext;
          return true;
        })();
        if (!stillBelongs) {
          setTasks((prev) => prev.filter((t) => t.id !== id));
        } else {
          setTasks((prev) => prev.map((t) => t.id === id ? updated : t));
        }
      }
    } catch (err) { console.error(err); }
  };

  const toggleTask = async (task) => {
    const newCompleted = !task.completed;
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, completed: newCompleted ? 1 : 0 } : t));
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
        invalidateCache();
        setTasks((prev) => prev.filter((t) => t.id !== id));
      },
    });
  };

  const invalidateCache = () => { cacheRef.current = {}; };

  const addTask = async (fields) => {
    const date = subtab === 'inbox' || subtab === 'waiting' || subtab === 'someday' || subtab === 'contexts' ? null
      : subtab === 'today' ? today
      : subtab === 'tomorrow' ? tomorrow
      : fields.date || null;

    const list_type = subtab === 'waiting' ? 'waiting'
      : subtab === 'someday' ? 'someday'
      : 'active';

    const context = subtab === 'contexts' ? activeContext : fields.context;

    const res = await fetch(`${API}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, date, list_type, context }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
    const newTask = await res.json();
    invalidateCache();
    setTasks((prev) => [...prev, newTask]);
    setShowAddForm(false);
  };

  const defaultDate = subtab === 'today' ? today : subtab === 'tomorrow' ? tomorrow : '';
  const incomplete = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  const emptyMessages = {
    inbox:    'No unscheduled tasks. Tasks without a date land here.',
    today:    'No tasks for today.',
    tomorrow: 'No tasks for tomorrow.',
    later:    'No upcoming tasks.',
    waiting:  'Nothing waiting. Use this list to track items delegated or pending others.',
    someday:  'Someday/Maybe list is empty.',
    contexts: `No tasks for @${activeContext}.`,
  };

  return (
    <div className="tasks-view">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="subtab-nav">
        {SUBTABS.map(({ id, label }) => (
          <button
            key={id}
            className={`subtab-btn${subtab === id ? ' subtab-btn--active' : ''}`}
            onClick={() => setSubtab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {subtab === 'contexts' && (
        <div className="context-filter-row">
          {CONTEXTS.map((c) => (
            <button
              key={c}
              className={`pill${activeContext === c ? ' pill--active pill-energy-deep' : ''}`}
              onClick={() => setActiveContext(c)}
            >
              @{c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /><div>Loading…</div></div>
      ) : (
        <>
          {incomplete.length === 0 && completed.length === 0 && !showAddForm && (
            <div className="planner-empty" style={{ marginTop: '1.5rem' }}>
              {emptyMessages[subtab] || 'No tasks.'}
            </div>
          )}

          {incomplete.length > 0 && (
            <div className="task-list" style={{ marginTop: '1rem' }}>
              {incomplete.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  nowTaskId={nowTaskId}
                  showDate={subtab === 'later' || subtab === 'contexts'}
                  onToggle={() => toggleTask(task)}
                  onUpdate={updateTask}
                  onDelete={() => deleteTask(task.id)}
                />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <details className="completed-section">
              <summary className="completed-summary">
                Completed ({completed.length})
              </summary>
              <div className="task-list">
                {completed.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    nowTaskId={nowTaskId}
                    showDate={subtab === 'later' || subtab === 'contexts'}
                    onToggle={() => toggleTask(task)}
                    onUpdate={updateTask}
                    onDelete={() => deleteTask(task.id)}
                  />
                ))}
              </div>
            </details>
          )}

          {showAddForm ? (
            <div className="task-form-wrapper" style={{ marginTop: '1rem' }}>
              <TaskForm
                defaultDate={defaultDate}
                defaultListType={subtab === 'waiting' ? 'waiting' : subtab === 'someday' ? 'someday' : 'active'}
                defaultContext={subtab === 'contexts' ? activeContext : undefined}
                projects={projects}
                onSave={addTask}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          ) : (
            <button className="btn-add-task" onClick={() => setShowAddForm(true)}>
              <span>+</span> Add task
            </button>
          )}
        </>
      )}
    </div>
  );
}
