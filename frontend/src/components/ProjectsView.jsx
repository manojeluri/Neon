import { API } from '../api';
import React, { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from './ConfirmDialog.jsx';
import { FolderPlus, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Archive, Trash2, Plus, Target } from 'lucide-react';

function AddProjectForm({ onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [purpose, setPurpose] = useState('');
  const [outcome, setOutcome] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), purpose, outcome }),
      });
      onSaved(await res.json());
    } catch (err) { console.error(err); setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">New Project</div>
        <form onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">Title *</label>
            <input
              className="process-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project name…"
              autoFocus
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">Why? (purpose)</label>
            <input
              className="process-input"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What's the intent behind this project?"
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">What does done look like? (outcome)</label>
            <input
              className="process-input"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Visualize the successful completion…"
            />
          </div>
          <div className="process-actions">
            <button type="button" className="process-btn process-btn--back" onClick={onClose}>Cancel</button>
            <button type="submit" className="process-btn process-btn--save" disabled={!title.trim() || saving}>
              {saving ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddTaskToProjectForm({ projectId, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('anywhere');
  const [saving, setSaving] = useState(false);
  const CONTEXTS = ['anywhere', 'computer', 'phone', 'errands', 'home', 'office'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          context,
          priority: 'should',
          project_id: projectId,
          list_type: 'active',
        }),
      });
      onSaved();
    } catch (err) { console.error(err); setSaving(false); }
  };

  return (
    <div className="project-add-task-form">
      <form onSubmit={handleSubmit}>
        <input
          className="process-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Next action…"
          autoFocus
        />
        <div className="pill-group" style={{ marginTop: '8px' }}>
          {CONTEXTS.map((c) => (
            <button key={c} type="button"
              className={`pill${context === c ? ' pill--active pill-energy-deep' : ''}`}
              onClick={() => setContext(c)}
            >@{c}</button>
          ))}
        </div>
        <div className="process-actions" style={{ marginTop: '10px' }}>
          <button type="button" className="process-btn process-btn--back" onClick={onClose}>Cancel</button>
          <button type="submit" className="process-btn process-btn--save" disabled={!title.trim() || saving}>
            {saving ? 'Adding…' : 'Add Action'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProjectCard({ project, stuckIds, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const isStuck = stuckIds.has(project.id);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch(`${API}/api/projects/${project.id}/tasks`);
      setTasks(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoadingTasks(false); }
  }, [project.id]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && tasks.length === 0) loadTasks();
  };

  const handleTaskDone = async (taskId) => {
    await fetch(`${API}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: 1 }),
    });
    loadTasks();
  };

  const handleTaskAdded = () => {
    setShowAddTask(false);
    loadTasks();
  };

  const activeTasks = tasks.filter((t) => !t.completed && t.list_type !== 'someday');
  const doneTasks = tasks.filter((t) => t.completed);

  return (
    <div className={`project-card${isStuck ? ' project-card--stuck' : ''}${project.status === 'someday' ? ' project-card--someday' : ''}`}>
      <div className="project-card-header" onClick={handleExpand}>
        <div className="project-card-left">
          <span className="project-expand-icon">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <div className="project-card-info">
            <span className="project-title">{project.title}</span>
            {project.purpose && (
              <span className="project-purpose">Why: {project.purpose}</span>
            )}
          </div>
        </div>
        <div className="project-card-right">
          {isStuck && (
            <span className="project-stuck-badge" title="No next action defined">
              <AlertTriangle size={11} /> stuck
            </span>
          )}
          <span className="project-task-count">{project.task_count || 0} actions</span>
          <div className="project-actions" onClick={(e) => e.stopPropagation()}>
            {project.status === 'active' && (
              <>
                <button
                  className="proj-btn proj-btn--someday"
                  title="Move to Someday/Maybe"
                  onClick={() => onStatusChange(project.id, 'someday')}
                >
                  Archive
                </button>
                <button
                  className="proj-btn proj-btn--done"
                  title="Mark complete"
                  onClick={() => onStatusChange(project.id, 'completed')}
                >
                  <CheckCircle size={12} /> Done
                </button>
              </>
            )}
            {project.status === 'someday' && (
              <button
                className="proj-btn proj-btn--activate"
                onClick={() => onStatusChange(project.id, 'active')}
              >
                Activate
              </button>
            )}
            <button
              className="proj-btn proj-btn--trash"
              onClick={() => onDelete(project.id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="project-card-body">
          {project.outcome && (
            <div className="project-outcome">
              <Target size={11} /> Done looks like: {project.outcome}
            </div>
          )}

          {loadingTasks ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <>
              {activeTasks.length === 0 && !showAddTask && (
                <div className="project-no-actions">No next actions — define one to keep momentum.</div>
              )}
              {activeTasks.map((t) => (
                <div key={t.id} className="project-task-row">
                  <button className="project-task-check" onClick={() => handleTaskDone(t.id)} />
                  <span className="project-task-title">{t.title}</span>
                  {t.context && <span className="context-badge">@{t.context}</span>}
                </div>
              ))}
              {doneTasks.length > 0 && (
                <div className="project-done-count">{doneTasks.length} completed action{doneTasks.length !== 1 ? 's' : ''}</div>
              )}
              {showAddTask ? (
                <AddTaskToProjectForm
                  projectId={project.id}
                  onClose={() => setShowAddTask(false)}
                  onSaved={handleTaskAdded}
                />
              ) : (
                <button className="project-add-action-btn" onClick={() => setShowAddTask(true)}>
                  <Plus size={11} /> Add next action
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [stuckIds, setStuckIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [subtab, setSubtab] = useState('active');

  const fetchProjects = useCallback(async () => {
    try {
      const [projRes, stuckRes] = await Promise.all([
        fetch(`${API}/api/projects`),
        fetch(`${API}/api/projects/stuck`),
      ]);
      const all = await projRes.json();
      const stuck = await stuckRes.json();
      setProjects(all);
      setStuckIds(new Set(stuck.map((p) => p.id)));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const handleStatusChange = async (id, status) => {
    await fetch(`${API}/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchProjects();
  };

  const handleDelete = (id) => {
    setConfirm({
      message: 'Delete this project? Its tasks will remain.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        await fetch(`${API}/api/projects/${id}`, { method: 'DELETE' });
        fetchProjects();
      },
    });
  };

  const handleProjectAdded = (proj) => {
    setProjects((prev) => [proj, ...prev]);
    setShowAdd(false);
  };

  const activeProjects = projects.filter((p) => p.status === 'active');
  const somedayProjects = projects.filter((p) => p.status === 'someday');
  const completedProjects = projects.filter((p) => p.status === 'completed');
  const stuckCount = [...stuckIds].filter((id) => activeProjects.find((p) => p.id === id)).length;

  const displayed = subtab === 'active' ? activeProjects
    : subtab === 'someday' ? somedayProjects
    : completedProjects;

  return (
    <div className="projects-view">
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="projects-header">
        <div className="projects-subtabs">
          {[
            { id: 'active', label: `Active (${activeProjects.length})` },
            { id: 'someday', label: `Someday (${somedayProjects.length})` },
            { id: 'completed', label: `Done (${completedProjects.length})` },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`subtab-btn${subtab === id ? ' subtab-btn--active' : ''}`}
              onClick={() => setSubtab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="btn-add-project" onClick={() => setShowAdd(true)}>
          <FolderPlus size={13} /> New Project
        </button>
      </div>

      {subtab === 'active' && stuckCount > 0 && (
        <div className="projects-stuck-banner">
          <AlertTriangle size={13} />
          {stuckCount} project{stuckCount !== 1 ? 's' : ''} stuck — no next action defined.
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : displayed.length === 0 ? (
        <div className="inbox-zero">
          <div className="inbox-zero-icon">
            {subtab === 'active' ? '◈' : subtab === 'someday' ? '◌' : '◉'}
          </div>
          <div className="inbox-zero-title">
            {subtab === 'active' ? 'No active projects' : subtab === 'someday' ? 'Nothing parked here' : 'No completed projects'}
          </div>
          <div className="inbox-zero-sub">
            {subtab === 'active' ? 'Create a project to track multi-step outcomes.' : subtab === 'someday' ? 'Projects you want to do eventually land here.' : 'Completed projects will appear here.'}
          </div>
        </div>
      ) : (
        <div className="projects-list">
          {displayed.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              stuckIds={stuckIds}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddProjectForm onClose={() => setShowAdd(false)} onSaved={handleProjectAdded} />
      )}
    </div>
  );
}
