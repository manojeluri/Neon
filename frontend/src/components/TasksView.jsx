import { API } from '../api';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import TaskCard from './TaskCard.jsx';
import TaskForm from './TaskForm.jsx';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableTaskCard({ task, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const verticalTransform = transform ? { ...transform, x: 0 } : null;
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'sortable-item--dragging' : undefined}
      style={{
        transform: CSS.Transform.toString(verticalTransform),
        transition: isDragging ? undefined : (transition || 'transform 220ms cubic-bezier(0.25, 1, 0.5, 1)'),
        position: 'relative',
        zIndex: isDragging ? 100 : undefined,
      }}
    >
      <TaskCard task={task} {...props} dragListeners={listeners} dragAttributes={attributes} />
    </div>
  );
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SUBTABS = [
  { id: 'active',  label: 'Active' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'someday', label: 'Someday' },
];

const CONTEXTS = ['computer', 'phone', 'errands', 'home', 'office'];

export default function TasksView({ refreshKey = 0 }) {
  const today = getTodayStr();

  const [subtab, setSubtab]               = useState('active');
  const [tasks, setTasks]                 = useState([]);
  const [nowTaskId, setNowTaskId]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [contextFilter, setContextFilter] = useState('all');
  const [projects, setProjects]           = useState([]);
  const [confirm, setConfirm]             = useState(null);
  const cacheRef = useRef({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/projects`);
      setProjects(await res.json());
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const fetchTasks = useCallback(async () => {
    const cached = cacheRef.current[subtab];
    if (cached) { setTasks(cached); setLoading(false); } else { setLoading(true); }
    try {
      const url = subtab === 'active'  ? `${API}/api/tasks/active`
               : subtab === 'waiting' ? `${API}/api/tasks/waiting`
               :                        `${API}/api/tasks/someday`;
      const [tasksRes, nowRes] = await Promise.all([fetch(url), fetch(`${API}/api/tasks/now`)]);
      const data    = await tasksRes.json();
      const nowData = await nowRes.json();
      const arr = Array.isArray(data) ? data : [];
      cacheRef.current[subtab] = arr;
      setTasks(arr);
      setNowTaskId(nowData ? nowData.id : null);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [subtab]);

  useEffect(() => { fetchTasks(); setShowAddForm(false); }, [fetchTasks]);

  useEffect(() => {
    if (refreshKey === 0) return;
    cacheRef.current = {};
    fetchTasks();
  }, [refreshKey]);

  const invalidateCache = () => { cacheRef.current = {}; };

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
        const stillBelongs = subtab === 'active'  ? (!fields.list_type || fields.list_type === 'active')
                           : subtab === 'waiting' ? updated.list_type === 'waiting'
                           :                        updated.list_type === 'someday';
        if (!stillBelongs) {
          setTasks(prev => prev.filter(t => t.id !== id));
        } else {
          setTasks(prev => prev.map(t => t.id === id ? updated : t));
        }
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
        invalidateCache();
        setTasks(prev => prev.filter(t => t.id !== id));
      },
    });
  };

  const addTask = async (fields) => {
    const list_type = subtab === 'waiting' ? 'waiting' : subtab === 'someday' ? 'someday' : 'active';
    const context   = contextFilter !== 'all' ? contextFilter : fields.context;
    const res = await fetch(`${API}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, list_type, context }),
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
    const newTask = await res.json();
    invalidateCache();
    setTasks(prev => [...prev, newTask]);
    setShowAddForm(false);
  };

  // Reorder within Unscheduled group (Active tab)
  const handleUnscheduledReorder = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const source = tasks.filter(t => !t.completed && (!t.date || t.date === ''));
    const oldIdx = source.findIndex(t => t.id === active.id);
    const newIdx = source.findIndex(t => t.id === over.id);
    const reordered = arrayMove(source, oldIdx, newIdx);
    const map = new Map(reordered.map(t => [t.id, t]));
    setTasks(prev => prev.map(t => map.get(t.id) || t));
    invalidateCache();
    fetch(`${API}/api/tasks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_ids: reordered.map(t => t.id) }),
    }).catch(() => fetchTasks());
  };

  // Reorder for flat lists (Waiting / Someday)
  const handleFlatReorder = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const inc  = tasks.filter(t => !t.completed);
    const comp = tasks.filter(t => t.completed);
    const oldIdx = inc.findIndex(t => t.id === active.id);
    const newIdx = inc.findIndex(t => t.id === over.id);
    const reordered = arrayMove(inc, oldIdx, newIdx);
    setTasks([...reordered, ...comp]);
    invalidateCache();
    fetch(`${API}/api/tasks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_ids: reordered.map(t => t.id) }),
    }).catch(() => fetchTasks());
  };

  // ── Derived state ──────────────────────────────────────────────────────────

  const filtered = subtab === 'active' && contextFilter !== 'all'
    ? tasks.filter(t => t.context === contextFilter)
    : tasks;

  const incomplete = filtered.filter(t => !t.completed);
  const completed  = filtered.filter(t => t.completed);

  const groups = subtab === 'active' ? {
    overdue:      incomplete.filter(t => t.date && t.date < today),
    today:        incomplete.filter(t => t.date === today),
    upcoming:     incomplete.filter(t => t.date && t.date > today),
    unscheduled:  incomplete.filter(t => !t.date || t.date === ''),
  } : null;

  const emptyMessages = {
    active:  'No active tasks.',
    waiting: 'Nothing waiting. Use this for delegated tasks.',
    someday: 'Someday/Maybe is empty.',
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

      {/* ── 3-tab nav ── */}
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

      {/* ── Context filter (Active tab only) ── */}
      {subtab === 'active' && (
        <div className="context-filter-row">
          <button
            className={`pill${contextFilter === 'all' ? ' pill--active pill-energy-deep' : ''}`}
            onClick={() => setContextFilter('all')}
          >
            All
          </button>
          {CONTEXTS.map(c => (
            <button
              key={c}
              className={`pill${contextFilter === c ? ' pill--active pill-energy-deep' : ''}`}
              onClick={() => setContextFilter(prev => prev === c ? 'all' : c)}
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
          {/* ── Add task ── */}
          {showAddForm ? (
            <div className="task-form-wrapper" style={{ marginTop: '1rem' }}>
              <TaskForm
                defaultListType={subtab === 'waiting' ? 'waiting' : subtab === 'someday' ? 'someday' : 'active'}
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

          {incomplete.length === 0 && completed.length === 0 && !showAddForm && (
            <div className="planner-empty" style={{ marginTop: '1.5rem' }}>
              {emptyMessages[subtab]}
            </div>
          )}

          {/* ── Active: grouped sections ── */}
          {subtab === 'active' && groups && (
            <div style={{ marginTop: '1rem' }}>

              {groups.overdue.length > 0 && (
                <div className="task-group">
                  <div className="task-group-header task-group-header--overdue">
                    Overdue <span className="task-group-count">{groups.overdue.length}</span>
                  </div>
                  <div className="task-list">
                    {groups.overdue.map(task => (
                      <TaskCard key={task.id} task={task} nowTaskId={nowTaskId}
                        showDate onToggle={() => toggleTask(task)}
                        onUpdate={updateTask} onDelete={() => deleteTask(task.id)} />
                    ))}
                  </div>
                </div>
              )}

              {groups.today.length > 0 && (
                <div className="task-group">
                  <div className="task-group-header task-group-header--today">
                    Today <span className="task-group-count">{groups.today.length}</span>
                  </div>
                  <div className="task-list">
                    {groups.today.map(task => (
                      <TaskCard key={task.id} task={task} nowTaskId={nowTaskId}
                        showDate={false} onToggle={() => toggleTask(task)}
                        onUpdate={updateTask} onDelete={() => deleteTask(task.id)} />
                    ))}
                  </div>
                </div>
              )}

              {groups.upcoming.length > 0 && (
                <div className="task-group">
                  <div className="task-group-header">
                    Upcoming <span className="task-group-count">{groups.upcoming.length}</span>
                  </div>
                  <div className="task-list">
                    {groups.upcoming.map(task => (
                      <TaskCard key={task.id} task={task} nowTaskId={nowTaskId}
                        showDate onToggle={() => toggleTask(task)}
                        onUpdate={updateTask} onDelete={() => deleteTask(task.id)} />
                    ))}
                  </div>
                </div>
              )}

              {groups.unscheduled.length > 0 && (
                <div className="task-group">
                  <div className="task-group-header">
                    Unscheduled <span className="task-group-count">{groups.unscheduled.length}</span>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleUnscheduledReorder}
                  >
                    <SortableContext items={groups.unscheduled.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <div className="task-list">
                        {groups.unscheduled.map(task => (
                          <SortableTaskCard key={task.id} task={task} nowTaskId={nowTaskId}
                            showDate={false} onToggle={() => toggleTask(task)}
                            onUpdate={updateTask} onDelete={() => deleteTask(task.id)} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {/* ── Waiting / Someday: flat sortable ── */}
          {subtab !== 'active' && incomplete.length > 0 && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleFlatReorder}
            >
              <SortableContext items={incomplete.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="task-list" style={{ marginTop: '1rem' }}>
                  {incomplete.map(task => (
                    <SortableTaskCard key={task.id} task={task} nowTaskId={nowTaskId}
                      showDate={false} onToggle={() => toggleTask(task)}
                      onUpdate={updateTask} onDelete={() => deleteTask(task.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* ── Completed ── */}
          {completed.length > 0 && (
            <details className="completed-section">
              <summary className="completed-summary">Completed ({completed.length})</summary>
              <div className="task-list">
                {completed.map(task => (
                  <TaskCard key={task.id} task={task} nowTaskId={nowTaskId}
                    showDate={subtab === 'active'} onToggle={() => toggleTask(task)}
                    onUpdate={updateTask} onDelete={() => deleteTask(task.id)} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
