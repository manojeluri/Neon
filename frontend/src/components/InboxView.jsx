import { API } from '../api';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Inbox, Trash2 } from 'lucide-react';

function InboxItem({ item, onAction, onDelete }) {
  const [title, setTitle] = useState(item.content);
  const [saving, setSaving] = useState(null); // which action is in-flight
  const [error, setError] = useState('');

  const handleAction = async (action) => {
    const text = title.trim() || item.content;
    setSaving(action);
    setError('');
    try {
      await onAction(item, action, text);
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      setSaving(null);
    }
  };

  return (
    <div className={`inbox-item${saving ? ' inbox-item--saving' : ''}`}>
      <input
        className="inbox-item-text-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={!!saving}
        aria-label="Edit item"
      />
      <div className="inbox-item-actions">
        <button
          className="inbox-action inbox-action--task"
          onClick={() => handleAction('task')}
          disabled={!!saving || !title.trim()}
        >
          {saving === 'task' ? '…' : 'Task'}
        </button>
        <button
          className="inbox-action inbox-action--project"
          onClick={() => handleAction('project')}
          disabled={!!saving || !title.trim()}
        >
          {saving === 'project' ? '…' : 'Project'}
        </button>
        <button
          className="inbox-action inbox-action--someday"
          onClick={() => handleAction('someday')}
          disabled={!!saving || !title.trim()}
        >
          {saving === 'someday' ? '…' : 'Someday'}
        </button>
        <button
          className="inbox-action inbox-action--delete"
          onClick={onDelete}
          disabled={!!saving}
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {error && <div className="inbox-item-error">{error}</div>}
    </div>
  );
}

export default function InboxView({ onInboxChange, onTaskCreated }) {
  const [items, setItems] = useState([]);
  const [capture, setCapture] = useState('');
  const [loading, setLoading] = useState(true);
  const [captureError, setCaptureError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const inputRef = useRef(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/inbox`);
      setItems(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCapture = async (e) => {
    e.preventDefault();
    const text = capture.trim();
    if (!text) return;
    setCapturing(true);

    // Optimistic update — add immediately, reconcile after server responds
    const tempId = `temp-${Date.now()}`;
    const tempItem = { id: tempId, _key: tempId, content: text };
    setItems((prev) => [tempItem, ...prev]);
    setCapture('');
    setCaptureError('');
    inputRef.current?.focus();
    onInboxChange?.();

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
      // Swap in the real ID but keep _key stable so React doesn't remount the component
      setItems((prev) => prev.map((i) => (i.id === tempId ? { ...newItem, _key: tempId } : i)));
    } catch (err) {
      // Roll back the optimistic item and restore the input
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      setCapture(text);
      setCaptureError(err.message || 'Failed to capture. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleAction = async (item, action, text) => {
    let res;
    if (action === 'task') {
      res = await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text, context: 'anywhere', priority: 'should', list_type: 'active' }),
      });
    } else if (action === 'project') {
      res = await fetch(`${API}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text }),
      });
    } else if (action === 'someday') {
      res = await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text, list_type: 'someday', priority: 'could' }),
      });
    }

    if (res && !res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `Server error ${res.status}`);
    }

    await fetch(`${API}/api/inbox/${item.id}`, { method: 'DELETE' }).catch((e) =>
      console.error('inbox delete failed', e)
    );
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    onInboxChange?.();
    if (action === 'task') onTaskCreated?.();
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
      {captureError && <div className="capture-error">{captureError}</div>}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="inbox-zero">
          <div className="inbox-zero-icon">◎</div>
          <div className="inbox-zero-title">Inbox Zero</div>
          <div className="inbox-zero-sub">Nothing left to sort. Your mind is clear.</div>
        </div>
      ) : (
        <>
          <div className="inbox-meta">
            <span className="inbox-count">
              {items.length} item{items.length !== 1 ? 's' : ''} to sort
            </span>
          </div>
          <div className="inbox-list">
            {items.map((item) => (
              <InboxItem
                key={item._key || item.id}
                item={item}
                onAction={handleAction}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
