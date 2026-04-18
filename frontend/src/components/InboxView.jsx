import { API } from '../api';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Inbox, Trash2 } from 'lucide-react';

const CONTEXTS = ['anywhere', 'computer', 'phone', 'errands', 'home', 'office'];
const PRIORITIES = ['must', 'should', 'could'];

function ProcessPanel({ item, projects, onDone }) {
  const [route, setRoute] = useState(''); // '' | 'task' | 'project' | 'someday'
  const [title, setTitle] = useState(item.content);
  const [context, setContext] = useState('anywhere');
  const [priority, setPriority] = useState('should');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleFinish = async (r) => {
    setSaving(true);
    setSaveError('');
    try {
      if (r === 'trash') {
        await fetch(`${API}/api/inbox/${item.id}`, { method: 'DELETE' });
        onDone();
        return;
      }

      let res;
      if (r === 'someday') {
        res = await fetch(`${API}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), list_type: 'someday', priority: 'could' }),
        });
      } else if (r === 'project') {
        res = await fetch(`${API}/api/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim() }),
        });
      } else if (r === 'task') {
        res = await fetch(`${API}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), context, priority, list_type: 'active' }),
        });
      }

      if (res && !res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }

      await fetch(`${API}/api/inbox/${item.id}`, { method: 'DELETE' }).catch((e) => console.error('inbox delete failed', e));
      onDone();
    } catch (err) {
      console.error(err);
      setSaveError(err.message || 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <div className="process-panel">
      <input
        className="process-input process-input--title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      {/* Route buttons — always visible until saved */}
      {!route && (
        <div className="process-routes">
          <button className="process-route-btn process-route-btn--task"    onClick={() => setRoute('task')}>Task</button>
          <button className="process-route-btn process-route-btn--project" onClick={() => setRoute('project')}>Project</button>
          <button className="process-route-btn process-route-btn--someday" onClick={() => setRoute('someday')}>Someday</button>
          <button className="process-route-btn process-route-btn--trash"   onClick={() => handleFinish('trash')} disabled={saving}>
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {route === 'task' && (
        <div className="process-detail">
          <div className="process-inline-row">
            <div className="pill-group">
              {PRIORITIES.map((p) => (
                <button key={p} type="button"
                  className={`pill pill-priority-${p}${priority === p ? ' pill--active' : ''}`}
                  onClick={() => setPriority(p)}
                >{p}</button>
              ))}
            </div>
            <div className="pill-group">
              {CONTEXTS.map((c) => (
                <button key={c} type="button"
                  className={`pill${context === c ? ' pill--active pill-energy-deep' : ''}`}
                  onClick={() => setContext(c)}
                >@{c}</button>
              ))}
            </div>
          </div>
          {saveError && <div className="process-save-error">{saveError}</div>}
          <div className="process-actions">
            <button className="process-btn process-btn--back" onClick={() => setRoute('')}>← Back</button>
            <button className="process-btn process-btn--save" disabled={!title.trim() || saving} onClick={() => handleFinish('task')}>
              {saving ? 'Saving…' : 'Add to Tasks'}
            </button>
          </div>
        </div>
      )}

      {route === 'project' && (
        <div className="process-detail">
          {saveError && <div className="process-save-error">{saveError}</div>}
          <div className="process-actions">
            <button className="process-btn process-btn--back" onClick={() => setRoute('')}>← Back</button>
            <button className="process-btn process-btn--save" disabled={!title.trim() || saving} onClick={() => handleFinish('project')}>
              {saving ? 'Saving…' : 'Create Project'}
            </button>
          </div>
        </div>
      )}

      {route === 'someday' && (
        <div className="process-detail">
          {saveError && <div className="process-save-error">{saveError}</div>}
          <div className="process-actions">
            <button className="process-btn process-btn--back" onClick={() => setRoute('')}>← Back</button>
            <button className="process-btn process-btn--save" disabled={!title.trim() || saving} onClick={() => handleFinish('someday')}>
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
  const [captureError, setCaptureError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const inputRef = useRef(null);

  const fetchItems = useCallback(async () => {
    try {
      const [itemsRes, projectsRes] = await Promise.all([
        fetch(`${API}/api/inbox`),
        fetch(`${API}/api/projects`),
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
    setCapturing(true);
    setCaptureError('');
    try {
      const res = await fetch(`${API}/api/inbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      const newItem = await res.json();
      setItems((prev) => [newItem, ...prev]);
      setCapture('');
      onInboxChange?.();
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
      setCaptureError(err.message || 'Failed to capture. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleProcessDone = () => {
    setProcessingId(null);
    fetchItems();
    onInboxChange?.();
  };

  const handleDelete = async (id) => {
    await fetch(`${API}/api/inbox/${id}`, { method: 'DELETE' });
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
          onChange={(e) => { setCapture(e.target.value); setCaptureError(''); }}
          placeholder="Capture anything — tasks, ideas, worries…"
          autoFocus
        />
        <button type="submit" className="capture-submit" disabled={!capture.trim() || capturing}>
          {capturing ? '…' : 'Capture'}
        </button>
      </form>
      {captureError && (
        <div className="capture-error">{captureError}</div>
      )}

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
