import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Inbox, Trash2, ArrowRight, FolderPlus, Clock, Zap } from 'lucide-react';

const CONTEXTS = ['anywhere', 'computer', 'phone', 'errands', 'home', 'office'];
const PRIORITIES = ['must', 'should', 'could'];

function ProcessPanel({ item, projects, onDone }) {
  const [step, setStep] = useState('actionable'); // actionable → route → detail → done
  const [route, setRoute] = useState(''); // 'task' | 'project' | 'someday' | 'trash'
  const [title, setTitle] = useState(item.content);
  const [context, setContext] = useState('anywhere');
  const [priority, setPriority] = useState('should');
  const [estMinutes, setEstMinutes] = useState('');
  const [projectId, setProjectId] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectPurpose, setProjectPurpose] = useState('');
  const [projectOutcome, setProjectOutcome] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTwoMin, setShowTwoMin] = useState(false);

  const est = parseInt(estMinutes, 10);

  useEffect(() => {
    if (est > 0 && est <= 2 && route === 'task') setShowTwoMin(true);
    else setShowTwoMin(false);
  }, [estMinutes, route, est]);

  const handleRoute = (r) => {
    setRoute(r);
    if (r === 'trash') { handleFinish(r); return; }
    setStep('detail');
  };

  const handleFinish = async (overrideRoute) => {
    const r = overrideRoute || route;
    setSaving(true);
    try {
      if (r === 'trash') {
        await fetch(`/api/inbox/${item.id}`, { method: 'DELETE' });
        onDone();
        return;
      }
      if (r === 'someday') {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), list_type: 'someday', priority }),
        });
      } else if (r === 'project') {
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: projectTitle.trim() || title.trim(),
            purpose: projectPurpose,
            outcome: projectOutcome,
          }),
        });
      } else if (r === 'task') {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            context,
            priority,
            est_minutes: est || null,
            project_id: projectId || null,
            list_type: 'active',
          }),
        });
      }
      await fetch(`/api/inbox/${item.id}`, { method: 'DELETE' });
      onDone();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div className="process-panel">
      <div className="process-item-text">"{item.content}"</div>

      {step === 'actionable' && (
        <div className="process-step">
          <div className="process-question">Is this actionable?</div>
          <div className="process-actions">
            <button className="process-btn process-btn--yes" onClick={() => setStep('route')}>
              <ArrowRight size={13} /> Yes, it requires action
            </button>
            <button className="process-btn process-btn--no" onClick={() => handleRoute('trash')}>
              <Trash2 size={13} /> No — trash it
            </button>
            <button className="process-btn process-btn--someday" onClick={() => handleRoute('someday')}>
              <Clock size={13} /> Maybe someday
            </button>
          </div>
        </div>
      )}

      {step === 'route' && (
        <div className="process-step">
          <div className="process-question">What is it?</div>
          <div className="process-actions">
            <button className="process-btn process-btn--task" onClick={() => handleRoute('task')}>
              <ArrowRight size={13} /> Single next action
            </button>
            <button className="process-btn process-btn--project" onClick={() => handleRoute('project')}>
              <FolderPlus size={13} /> Multi-step project
            </button>
          </div>
        </div>
      )}

      {step === 'detail' && route === 'task' && (
        <div className="process-step">
          <div className="process-question">Define the next action</div>
          <input
            className="process-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Next physical action…"
            autoFocus
          />
          {showTwoMin && (
            <div className="two-min-rule">
              <Zap size={11} />
              <span>Two-minute rule — do it now instead of adding it.</span>
              <button onClick={() => { fetch(`/api/inbox/${item.id}`, { method: 'DELETE' }); onDone(); }}>
                Done now
              </button>
            </div>
          )}
          <div className="process-row">
            <div className="process-field">
              <span className="process-label">Context</span>
              <div className="pill-group">
                {CONTEXTS.map((c) => (
                  <button key={c} type="button"
                    className={`pill${context === c ? ' pill--active pill-energy-deep' : ''}`}
                    onClick={() => setContext(c)}
                  >@{c}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="process-row">
            <div className="process-field">
              <span className="process-label">Priority</span>
              <div className="pill-group">
                {PRIORITIES.map((p) => (
                  <button key={p} type="button"
                    className={`pill pill-priority-${p}${priority === p ? ' pill--active' : ''}`}
                    onClick={() => setPriority(p)}
                  >{p}</button>
                ))}
              </div>
            </div>
            <div className="process-field">
              <span className="process-label">Est. min</span>
              <input
                className="process-input process-input--sm"
                type="number" min={1} max={480}
                value={estMinutes}
                onChange={(e) => setEstMinutes(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          </div>
          {projects.length > 0 && (
            <div className="process-field">
              <span className="process-label">Link to project (optional)</span>
              <select
                className="process-select"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">— No project —</option>
                {projects.filter(p => p.status === 'active').map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}
          <div className="process-actions">
            <button className="process-btn process-btn--back" onClick={() => setStep('route')}>← Back</button>
            <button
              className="process-btn process-btn--save"
              disabled={!title.trim() || saving}
              onClick={() => handleFinish()}
            >
              {saving ? 'Saving…' : 'Add to Tasks'}
            </button>
          </div>
        </div>
      )}

      {step === 'detail' && route === 'project' && (
        <div className="process-step">
          <div className="process-question">Define the project</div>
          <input
            className="process-input"
            value={projectTitle || title}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="Project title…"
            autoFocus
          />
          <input
            className="process-input"
            value={projectPurpose}
            onChange={(e) => setProjectPurpose(e.target.value)}
            placeholder="Why? (purpose)"
          />
          <input
            className="process-input"
            value={projectOutcome}
            onChange={(e) => setProjectOutcome(e.target.value)}
            placeholder="What does done look like? (outcome)"
          />
          <div className="process-actions">
            <button className="process-btn process-btn--back" onClick={() => setStep('route')}>← Back</button>
            <button
              className="process-btn process-btn--save"
              disabled={!(projectTitle || title).trim() || saving}
              onClick={() => handleFinish()}
            >
              {saving ? 'Saving…' : 'Create Project'}
            </button>
          </div>
        </div>
      )}

      {step === 'detail' && route === 'someday' && (
        <div className="process-step">
          <div className="process-question">Save to Someday/Maybe</div>
          <input
            className="process-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title…"
            autoFocus
          />
          <div className="process-actions">
            <button className="process-btn process-btn--back" onClick={() => setStep('actionable')}>← Back</button>
            <button
              className="process-btn process-btn--save"
              disabled={!title.trim() || saving}
              onClick={() => handleFinish()}
            >
              {saving ? 'Saving…' : 'Save to Someday'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxView({ onInboxChange }) {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [capture, setCapture] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const inputRef = useRef(null);

  const fetchItems = useCallback(async () => {
    try {
      const [itemsRes, projectsRes] = await Promise.all([
        fetch('/api/inbox'),
        fetch('/api/projects'),
      ]);
      setItems(await itemsRes.json());
      setProjects(await projectsRes.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCapture = async (e) => {
    e.preventDefault();
    const text = capture.trim();
    if (!text) return;
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const newItem = await res.json();
      setItems((prev) => [newItem, ...prev]);
      setCapture('');
      onInboxChange?.();
      inputRef.current?.focus();
    } catch (err) { console.error(err); }
  };

  const handleProcessDone = () => {
    setProcessingId(null);
    fetchItems();
    onInboxChange?.();
  };

  const handleDelete = async (id) => {
    await fetch(`/api/inbox/${id}`, { method: 'DELETE' });
    setItems((prev) => prev.filter((i) => i.id !== id));
    onInboxChange?.();
  };

  return (
    <div className="inbox-view">
      <form className="capture-bar" onSubmit={handleCapture}>
        <Inbox size={15} className="capture-icon" />
        <input
          ref={inputRef}
          className="capture-input"
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
          placeholder="Capture anything — tasks, ideas, worries, commitments…"
          autoFocus
        />
        <button type="submit" className="capture-submit" disabled={!capture.trim()}>
          Capture
        </button>
      </form>

      <div className="inbox-meta">
        {items.length > 0
          ? <span className="inbox-count">{items.length} item{items.length !== 1 ? 's' : ''} to process</span>
          : <span className="inbox-empty-msg">Inbox zero — your mind is clear.</span>
        }
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="inbox-zero">
          <div className="inbox-zero-icon">◎</div>
          <div className="inbox-zero-title">Inbox Zero</div>
          <div className="inbox-zero-sub">All captured items have been processed. Your mind is clear.</div>
        </div>
      ) : (
        <div className="inbox-list">
          {items.map((item) => (
            <div key={item.id} className={`inbox-item${processingId === item.id ? ' inbox-item--active' : ''}`}>
              {processingId === item.id ? (
                <ProcessPanel item={item} projects={projects} onDone={handleProcessDone} />
              ) : (
                <div className="inbox-item-row">
                  <span className="inbox-item-content">{item.content}</span>
                  <div className="inbox-item-actions">
                    <button className="inbox-btn inbox-btn--process" onClick={() => setProcessingId(item.id)}>
                      Process
                    </button>
                    <button className="inbox-btn inbox-btn--trash" onClick={() => handleDelete(item.id)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
