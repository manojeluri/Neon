import React, { useState, useEffect, useCallback, useRef } from 'react';

const AGENT_URL = 'http://localhost:5001';
const IS_PROD = import.meta.env.PROD;

function StatusDot({ status }) {
  const color =
    status === 'ready' ? 'var(--accent)'
    : status === 'indexing' ? '#f5c518'
    : status === 'error' ? '#e05252'
    : 'rgba(255,140,60,0.3)';
  return (
    <span className="ai-status-dot" style={{ background: color }} />
  );
}

export default function AIView() {
  const [vaultStatus, setVaultStatus] = useState(null); // null = unknown
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState({ current: 0, total: 0, file: '' });
  const [generating, setGenerating] = useState(false);
  const [todos, setTodos] = useState([]);
  const [addedIds, setAddedIds] = useState(new Set());
  const [error, setError] = useState('');
  const [addingAll, setAddingAll] = useState(false);
  const pollRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${AGENT_URL}/api/index/status`);
      if (!res.ok) throw new Error('unreachable');
      const data = await res.json();
      setVaultStatus(data);
      setError('');
      return data;
    } catch {
      setVaultStatus(null);
      setError('todoAgent server not reachable. Make sure it\'s running on port 5001.');
      return null;
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const data = await fetchStatus();
      if (!data) { stopPolling(); return; }
      setIndexProgress({ current: data.progress || 0, total: data.total || 0, file: data.current_file || '' });
      if (data.status !== 'indexing') {
        stopPolling();
        setIndexing(false);
      }
    }, 1500);
  }, [fetchStatus]);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPolling(), []);

  const handleIndex = async () => {
    setError('');
    setIndexing(true);
    setIndexProgress({ current: 0, total: 0, file: '' });
    try {
      await fetch(`${AGENT_URL}/api/index`, { method: 'POST' });
      startPolling();
    } catch {
      setError('Failed to start indexing.');
      setIndexing(false);
    }
  };

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    setTodos([]);
    setAddedIds(new Set());
    try {
      const res = await fetch(`${AGENT_URL}/api/todos`, { method: 'POST' });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setTodos(data.todos || []);
    } catch (err) {
      setError(err.message || 'Failed to generate tasks.');
    } finally {
      setGenerating(false);
    }
  };

  const addToInbox = async (text, idx) => {
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error('Failed to add');
      setAddedIds((prev) => new Set([...prev, idx]));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddAll = async () => {
    setAddingAll(true);
    const unadded = todos.filter((_, i) => !addedIds.has(i));
    for (let i = 0; i < todos.length; i++) {
      if (!addedIds.has(i)) {
        await addToInbox(todos[i], i);
      }
    }
    setAddingAll(false);
  };

  const isReady = vaultStatus?.has_index;
  const isIndexing = vaultStatus?.status === 'indexing' || indexing;
  const progressPct = indexProgress.total > 0
    ? Math.round((indexProgress.current / indexProgress.total) * 100)
    : 0;
  const unadded = todos.filter((_, i) => !addedIds.has(i));

  if (IS_PROD) {
    return (
      <div className="ai-view">
        <div className="ai-header">
          <div className="ai-title-row">
            <span className="ai-title">AI Task Generator</span>
            <span className="ai-subtitle">Powered by your Obsidian vault</span>
          </div>
        </div>
        <div className="ai-offline-hint">
          <div className="ai-offline-title">Local only</div>
          <div className="ai-offline-body">
            The AI tab uses Ollama running on your local machine and is not available in the hosted version.
            Run NEON locally to use this feature.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-view">
      <div className="ai-header">
        <div className="ai-title-row">
          <span className="ai-title">AI Task Generator</span>
          <span className="ai-subtitle">Powered by your Obsidian vault</span>
        </div>
      </div>

      {/* Vault status card */}
      <div className="ai-card">
        <div className="ai-card-row">
          <StatusDot status={
            !vaultStatus ? 'none'
            : vaultStatus.status === 'indexing' ? 'indexing'
            : vaultStatus.has_index ? 'ready'
            : 'none'
          } />
          <span className="ai-vault-label">
            {!vaultStatus
              ? 'todoAgent offline'
              : vaultStatus.status === 'indexing'
              ? `Indexing… ${indexProgress.current}/${indexProgress.total} files`
              : vaultStatus.has_index
              ? `Vault indexed — ${vaultStatus.chunk_count?.toLocaleString() || 0} chunks`
              : 'Vault not indexed yet'}
          </span>
          {!isIndexing && (
            <button
              className="ai-btn ai-btn--secondary"
              onClick={handleIndex}
              disabled={!vaultStatus || isIndexing}
            >
              {isReady ? 'Re-index' : 'Index Vault'}
            </button>
          )}
        </div>

        {isIndexing && indexProgress.total > 0 && (
          <div className="ai-progress-wrap">
            <div className="ai-progress-bar">
              <div className="ai-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            {indexProgress.file && (
              <div className="ai-progress-file">{indexProgress.file}</div>
            )}
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        className="ai-btn ai-btn--primary"
        onClick={handleGenerate}
        disabled={!isReady || generating || isIndexing}
      >
        {generating ? (
          <><span className="ai-spinner" /> Generating…</>
        ) : (
          'Generate Tasks from Vault'
        )}
      </button>

      {error && <div className="ai-error">{error}</div>}

      {/* Results */}
      {todos.length > 0 && (
        <div className="ai-results">
          <div className="ai-results-header">
            <span className="ai-results-label">
              {todos.length} tasks generated
            </span>
            {unadded.length > 0 && (
              <button
                className="ai-btn ai-btn--add-all"
                onClick={handleAddAll}
                disabled={addingAll}
              >
                {addingAll ? 'Adding…' : `Add All to Inbox (${unadded.length})`}
              </button>
            )}
            {unadded.length === 0 && (
              <span className="ai-all-added">All added to Inbox ✓</span>
            )}
          </div>

          <div className="ai-todo-list">
            {todos.map((todo, i) => {
              const added = addedIds.has(i);
              return (
                <div
                  key={i}
                  className={`ai-todo-item${added ? ' ai-todo-item--added' : ''}`}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <span className="ai-todo-check">{added ? '✓' : '◇'}</span>
                  <span className="ai-todo-text">{todo}</span>
                  {!added && (
                    <button
                      className="ai-btn ai-btn--add"
                      onClick={() => addToInbox(todo, i)}
                    >
                      + Inbox
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!vaultStatus && (
        <div className="ai-offline-hint">
          <div className="ai-offline-title">todoAgent not running</div>
          <div className="ai-offline-body">
            Start the agent server to enable AI task generation:
            <code className="ai-code-block">cd ~/Desktop/Work/Coding/todoAgent && python server.py</code>
          </div>
        </div>
      )}
    </div>
  );
}
