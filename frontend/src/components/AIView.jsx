import { API } from '../api';
import React, { useState, useRef } from 'react';
import { FolderOpen, Sparkles, Plus, Check, AlertCircle } from 'lucide-react';

const RECENCY_OPTIONS = [
  { label: '7 days',  days: 7  },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: 'All',     days: null },
];

function cutoffMs(days) {
  if (!days) return 0;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export default function AIView() {
  const [allFiles,    setAllFiles]    = useState([]); // { file, name, lastModified }
  const [recencyDays, setRecencyDays] = useState(30);
  const [extracting,  setExtracting]  = useState(false);
  const [tasks,       setTasks]       = useState([]);
  const [filesUsed,   setFilesUsed]   = useState(0);
  const [addedIds,    setAddedIds]    = useState(new Set());
  const [addingAll,   setAddingAll]   = useState(false);
  const [error,       setError]       = useState('');
  const fileInputRef = useRef(null);

  // Filter to .md files within the chosen recency window
  const filteredFiles = allFiles.filter(
    (f) => f.lastModified >= cutoffMs(recencyDays)
  );

  const handleFolderSelect = (e) => {
    const mdFiles = Array.from(e.target.files)
      .filter((f) => f.name.toLowerCase().endsWith('.md'))
      .map((f) => ({ file: f, name: f.name, lastModified: f.lastModified }));
    setAllFiles(mdFiles);
    setTasks([]);
    setAddedIds(new Set());
    setError('');
    // Reset input so the same folder can be re-selected
    e.target.value = '';
  };

  const handleExtract = async () => {
    if (!filteredFiles.length) return;
    setExtracting(true);
    setTasks([]);
    setAddedIds(new Set());
    setError('');

    try {
      // Read all file contents in parallel
      const fileData = await Promise.all(
        filteredFiles.map(
          ({ file, name }) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload  = (e) => resolve({ name, content: e.target.result });
              reader.onerror = reject;
              reader.readAsText(file);
            })
        )
      );

      const res = await fetch(`${API}/api/ai/extract-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileData }),
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

  const addToInbox = async (text, idx) => {
    try {
      const res = await fetch(`${API}/api/inbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error('Failed to add to inbox');
      setAddedIds((prev) => new Set([...prev, idx]));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddAll = async () => {
    setAddingAll(true);
    for (let i = 0; i < tasks.length; i++) {
      if (!addedIds.has(i)) await addToInbox(tasks[i], i);
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
            Select your Obsidian vault — AI scans your recent notes and surfaces open loops
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
        <button
          className="ai-select-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderOpen size={14} />
          {hasFiles
            ? `${allFiles.length} notes found — change folder`
            : 'Select Obsidian vault folder'}
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
          <div className="ai-step-label">3 — Extract tasks</div>
          <button
            className="ai-btn ai-btn--primary"
            onClick={handleExtract}
            disabled={!hasFiltered || extracting}
          >
            {extracting ? (
              <><span className="ai-spinner" />Scanning {filteredFiles.length} notes…</>
            ) : (
              <><Sparkles size={13} style={{ marginRight: 6 }} />Extract tasks from {filteredFiles.length} notes</>
            )}
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
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} found across {filesUsed} notes
            </span>
            {unadded.length > 0 ? (
              <button
                className="ai-btn ai-btn--add-all"
                onClick={handleAddAll}
                disabled={addingAll}
              >
                {addingAll ? 'Adding…' : `Add all to Inbox (${unadded.length})`}
              </button>
            ) : (
              <span className="ai-all-added">
                <Check size={12} style={{ marginRight: 4 }} />All added to Inbox
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
                  <span className="ai-todo-text">{task}</span>
                  {!added && (
                    <button
                      className="ai-btn ai-btn--add"
                      onClick={() => addToInbox(task, i)}
                    >
                      <Plus size={10} style={{ marginRight: 3 }} />Inbox
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
