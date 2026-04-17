import React, { useState, useEffect, useCallback } from 'react';
import { Telescope, Target, Flame, Plus, Trash2, Edit3, Check, X } from 'lucide-react';

const HORIZONS = [
  {
    id: 'life',
    label: 'Life Vision',
    sublabel: 'Altitude 50,000 ft',
    description: 'Your core values, life purpose, and long-term direction. The "why" behind everything.',
    icon: Telescope,
    color: 'var(--accent)',
  },
  {
    id: '3year',
    label: '3–5 Year Goals',
    sublabel: 'Altitude 30,000 ft',
    description: 'Where do you want to be in 3-5 years? What does your life look like?',
    icon: Target,
    color: 'rgba(255,110,0,0.8)',
  },
  {
    id: '1year',
    label: '1 Year Goals',
    sublabel: 'Altitude 10,000 ft',
    description: 'What do you want to achieve this year? Specific, motivating outcomes.',
    icon: Flame,
    color: 'rgba(255,110,0,0.6)',
  },
];

function GoalItem({ goal, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description || '');

  const handleSave = async () => {
    await onUpdate(goal.id, { title: title.trim(), description });
    setEditing(false);
  };

  const handleCancel = () => {
    setTitle(goal.title);
    setDescription(goal.description || '');
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="goal-item goal-item--editing">
        <input
          className="process-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className="process-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notes or context…"
          rows={2}
          style={{ resize: 'vertical' }}
        />
        <div className="goal-edit-actions">
          <button className="icon-btn icon-btn--cancel" onClick={handleCancel}><X size={13} /></button>
          <button className="icon-btn icon-btn--save" onClick={handleSave} disabled={!title.trim()}><Check size={13} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="goal-item">
      <div className="goal-item-content">
        <div className="goal-item-title">{goal.title}</div>
        {goal.description && <div className="goal-item-desc">{goal.description}</div>}
      </div>
      <div className="goal-item-actions">
        <button className="icon-btn" onClick={() => setEditing(true)} title="Edit"><Edit3 size={12} /></button>
        <button className="icon-btn icon-btn--danger" onClick={() => onDelete(goal.id)} title="Delete"><Trash2 size={12} /></button>
      </div>
    </div>
  );
}

function HorizonSection({ horizon, goals, onAdd, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const Icon = horizon.icon;
  const hGoals = goals.filter((g) => g.horizon === horizon.id);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    await onAdd({ title: newTitle.trim(), description: newDesc, horizon: horizon.id });
    setNewTitle('');
    setNewDesc('');
    setShowAdd(false);
    setSaving(false);
  };

  return (
    <div className="horizon-section">
      <div className="horizon-header" onClick={() => setExpanded(!expanded)}>
        <div className="horizon-header-left">
          <span className="horizon-icon" style={{ color: horizon.color }}>
            <Icon size={16} />
          </span>
          <div>
            <div className="horizon-label">{horizon.label}</div>
            <div className="horizon-sublabel">{horizon.sublabel}</div>
          </div>
        </div>
        <div className="horizon-header-right">
          <span className="horizon-count">{hGoals.length}</span>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); setShowAdd(true); setExpanded(true); }}
            title="Add goal"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="horizon-body">
          <div className="horizon-description">{horizon.description}</div>

          {hGoals.length === 0 && !showAdd && (
            <div className="horizon-empty">
              Nothing defined yet. <button className="link-btn" onClick={() => setShowAdd(true)}>Add one.</button>
            </div>
          )}

          {hGoals.map((g) => (
            <GoalItem key={g.id} goal={g} onDelete={onDelete} onUpdate={onUpdate} />
          ))}

          {showAdd && (
            <form className="goal-add-form" onSubmit={handleAdd}>
              <input
                className="process-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Goal title…"
                autoFocus
              />
              <input
                className="process-input"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Notes (optional)…"
              />
              <div className="process-actions">
                <button type="button" className="process-btn process-btn--back" onClick={() => { setShowAdd(false); setNewTitle(''); setNewDesc(''); }}>Cancel</button>
                <button type="submit" className="process-btn process-btn--save" disabled={!newTitle.trim() || saving}>
                  {saving ? 'Adding…' : 'Add Goal'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function GoalsView() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals');
      setGoals(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleAdd = async (data) => {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const newGoal = await res.json();
    setGoals((prev) => [...prev, newGoal]);
  };

  const handleDelete = async (id) => {
    await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    setGoals((prev) => prev.filter((g) => g.id !== id));
  };

  const handleUpdate = async (id, fields) => {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const updated = await res.json();
    setGoals((prev) => prev.map((g) => g.id === id ? updated : g));
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="goals-view">
      <div className="goals-intro">
        <div className="goals-intro-title">Horizons of Focus</div>
        <div className="goals-intro-sub">
          Your commitments live at different altitudes. Clarity at every level keeps your projects and tasks aligned with what truly matters.
        </div>
      </div>

      <div className="goals-horizons">
        {HORIZONS.map((h) => (
          <HorizonSection
            key={h.id}
            horizon={h}
            goals={goals}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </div>
  );
}
