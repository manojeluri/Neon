import { API } from '../api';
import React, { useState, useEffect, useRef } from 'react';
import { FolderOpen, Sparkles, Plus, Check, AlertCircle } from 'lucide-react';

const RECENCY_OPTIONS = [
  { label: '7 days',  days: 7  },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: 'All',     days: null },
];

const PRIORITY_LABELS = { must: 'Must', should: 'Should', could: 'Could' };
const CONTEXT_LABELS  = { computer: 'Computer', phone: 'Phone', errands: 'Errands', home: 'Home', office: 'Office' };

function cutoffMs(days) {
  if (!days) return 0;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export default function AIView() {
  const [allFiles,    setAllFiles]    = useState([]);
  const [recencyDays, setRecencyDays] = useState(30);
  const [extracting,  setExtracting]  = useState(false);
  const [tasks,       setTasks]       = useState([]);  // [{title, priority, context, project}]
  const [filesUsed,   setFilesUsed]   = useState(0);
  const [addedIds,    setAddedIds]    = useState(new Set());
  const [addingAll,   setAddingAll]   = useState(false);
  const [error,       setError]       = useState('');
  const [projects,    setProjects]    = useState([]); // [{id, title}]
  const fileInputRef = useRef(null);

  // Load projects on mount so we can pass them to the AI and look up IDs when saving
  useEffect(() => {
    fetch(`${API}/api/projects`)
      .then(r => r.json())
      .then(data => setProjects(Array.isArray(data) ? data.filter(p => p.status === 'active') : []))
      .catch(() => {});
  }, []);

  const filteredFiles = allFiles.filter(f => f.lastModified >= cutoffMs(recencyDays));

  const handleFolderSelect = (e) => {
    const mdFiles = Array.from(e.target.files)
      .filter(f => f.name.toLowerCase().endsWith('.md'))
      .map(f => ({ file: f, name: f.name, lastModified: f.lastModified }));
    setAllFiles(mdFiles);
    setTasks([]);
    setAddedIds(new Set());
    setError('');
    e.target.value = '';
  };

  const handleExtract = async () => {
    if (!filteredFiles.length) return;
    setExtracting(true);
    setTasks([]);
    setAddedIds(new Set());
    setError('');

    try {
      // Fetch existing tasks (inbox + someday) to send as dedup context
      const [inboxRes, somedayRes] = await Promise.all([
        fetch(`${API}/api/tasks/inbox`),
        fetch(`${API}/api/tasks/someday`),
      ]);
      const [inbox, someday] = await Promise.all([inboxRes.json(), somedayRes.json()]);
      const existingTasks = [
        ...(Array.isArray(inbox)   ? inbox   : []),
        ...(Array.isArray(someday) ? someday : []),
      ].map(t => t.title).filter(Boolean);

      // Read file contents
      const fileData = await Promise.all(
        filteredFiles.map(({ file, name }) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = e => resolve({ name, content: e.target.result });
            reader.onerror = reject;
            reader.readAsText(file);
          })
        )
      );

      const res = await fetch(`${API}/api/ai/extract-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: fileData,
          existingTasks,
          projects: projects.map(p => p.title),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

      setTasks(data.tasks || []);
      setFilesUsed(data.files_processed || filteredFiles.length);
    } catch (err) {
      setError(err.message || 'Extraction failed. Try again.');
    } finally {
      setExtracting(false);
    }
  };

  // Add a single task directly to the Tasks list (not inbox) with its classified fields
  const addTask = async (task, idx) => {
    const project = projects.find(p => p.title === task.project);
    try {
      const res = await fetch(`${API}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:      task.title,
          priority:   task.priority,
          context:    task.context,
          project_id: project?.id || null,
          list_type:  'active',
        }),
      });
      if (!res.ok) throw new Error('Failed to add task');
      setAddedIds(prev => new Set([...prev, idx]));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddAll = async () => {
    setAddingAll(true);
    for (let i = 0; i < tasks.length; i++) {
      if (!addedIds.has(i)) await addTask(tasks[i], i);
    }
    setAddingAll(false);
  };

  const hasFiles    = allFiles.length > 0;
  const hasFiltered = filteredFiles.length > 0;
  const unadded     = tasks.filter((_, i) => !addedIds.has(i));

  return (
    <div className="ai-view">

      <div className="ai-header">
        <div className="ai-title-row">
          <span className="ai-title">Extract Tasks from Notes</span>
          <span className="ai-subtitle">
            Scans your Obsidian vault, skips what's already in NEON, and classifies each task automatically
          </span>
        </div>
      </div>

      {/* ── Step 1: Select folder ── */}
      <div className="ai-step">
        <div className="ai-step-label">1 — Select vault folder</div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          multiple
          {...{ webkitdirectory: '' }}
          style={{ display: 'none' }}
          onChange={handleFolderSelect}
        />
        <button className="ai-select-btn" onClick={() => fileInputRef.current?.click()}>
          <FolderOpen size={14} />
          {hasFiles ? `${allFiles.length} notes found — change folder` : 'Select Obsidian vault folder'}
        </button>
        {hasFiles && (
          <div className="ai-file-info">
            {allFiles.length} .md file{allFiles.length !== 1 ? 's' : ''} found in vault
          </div>
        )}
      </div>

      {/* ── Step 2: Recency filter ── */}
      {hasFiles && (
        <div className="ai-step">
          <div className="ai-step-label">2 — Filter to recent notes</div>
          <div className="pill-group">
            {RECENCY_OPTIONS.map(({ label, days }) => (
              <button
                key={label}
                type="button"
                className={`pill${recencyDays === days ? ' pill--active pill-energy-deep' : ''}`}
                onClick={() => setRecencyDays(days)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={`ai-file-info${!hasFiltered ? ' ai-file-info--warn' : ''}`}>
            {hasFiltered
              ? `${filteredFiles.length} note${filteredFiles.length !== 1 ? 's' : ''} in range`
              : 'No notes modified in this period — try a wider range'}
          </div>
        </div>
      )}

      {/* ── Step 3: Extract ── */}
      {hasFiles && (
        <div className="ai-step">
          <div className="ai-step-label">3 — Extract &amp; classify tasks</div>
          <button
            className="ai-btn ai-btn--primary"
            onClick={handleExtract}
            disabled={!hasFiltered || extracting}
          >
            {extracting
              ? <><span className="ai-spinner" />Scanning {filteredFiles.length} notes…</>
              : <><Sparkles size={13} style={{ marginRight: 6 }} />Extract from {filteredFiles.length} notes</>
            }
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="ai-error">
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {/* ── Results ── */}
      {tasks.length > 0 && (
        <div className="ai-results">
          <div className="ai-results-header">
            <span className="ai-results-label">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} · {filesUsed} notes scanned
            </span>
            {unadded.length > 0 ? (
              <button className="ai-btn ai-btn--add-all" onClick={handleAddAll} disabled={addingAll}>
                {addingAll ? 'Adding…' : `Add all to Tasks (${unadded.length})`}
              </button>
            ) : (
              <span className="ai-all-added">
                <Check size={12} style={{ marginRight: 4 }} />All added to Tasks
              </span>
            )}
          </div>

          <div className="ai-todo-list">
            {tasks.map((task, i) => {
              const added = addedIds.has(i);
              return (
                <div
                  key={i}
                  className={`ai-todo-item${added ? ' ai-todo-item--added' : ''}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <span className="ai-todo-check">
                    {added ? <Check size={11} /> : '◇'}
                  </span>

                  <div className="ai-todo-body">
                    <span className="ai-todo-text">{task.title}</span>
                    <div className="ai-todo-meta">
                      {task.priority !== 'should' && (
                        <span className={`priority-badge priority-${task.priority}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      )}
                      {task.context !== 'anywhere' && (
                        <span className="context-badge">@{task.context}</span>
                      )}
                      {task.project && (
                        <span className="project-badge">{task.project}</span>
                      )}
                    </div>
                  </div>

                  {!added && (
                    <button className="ai-btn ai-btn--add" onClick={() => addTask(task, i)}>
                      <Plus size={10} style={{ marginRight: 3 }} />Task
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
