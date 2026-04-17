import { API } from '../api';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Circle, ChevronRight, RotateCcw } from 'lucide-react';

const STEPS = [
  {
    id: 'inbox',
    title: 'Step 1 — Empty Your Inboxes',
    description: 'Process every inbox to zero: physical trays, email, notes, voice memos. Capture anything still in your head.',
    action: 'Mark your physical inboxes as cleared',
    checkLabel: 'All inboxes processed to zero',
  },
  {
    id: 'calendar',
    title: 'Step 2 — Review Your Calendar',
    description: 'Look back at the past week — what happened? Look ahead at the next 2 weeks — any preparation needed?',
    action: 'Review past + next 2 weeks on your calendar',
    checkLabel: 'Calendar reviewed',
  },
  {
    id: 'next-actions',
    title: 'Step 3 — Review Next Actions',
    description: 'Go through every next action list. Mark off completed ones. Add any new ones you think of.',
    action: 'Check your task lists and mark off completed items',
    checkLabel: 'Next actions lists reviewed',
  },
  {
    id: 'projects',
    title: 'Step 4 — Review Projects',
    description: 'Every project should have at least one next action. If a project has no next action, it\'s "stuck." Define one now.',
    action: 'Ensure every project has a next action',
    checkLabel: 'All projects have a next action',
  },
  {
    id: 'waiting',
    title: 'Step 5 — Review Waiting For',
    description: 'Check your Waiting For list. Is anything overdue? Should you follow up with anyone?',
    action: 'Review items you\'re waiting on from others',
    checkLabel: 'Waiting For list reviewed',
  },
  {
    id: 'someday',
    title: 'Step 6 — Review Someday/Maybe',
    description: 'Look through your Someday/Maybe list. Should any items be activated? Any that no longer interest you?',
    action: 'Review deferred projects and ideas',
    checkLabel: 'Someday/Maybe reviewed',
  },
  {
    id: 'plan',
    title: 'Step 7 — Be Creative & Courageous',
    description: 'Look at the bigger picture. What projects would make the biggest difference? What have you been avoiding? What bold moves could you make?',
    action: 'Write your intentions and focus for the coming week',
    checkLabel: 'Weekly intentions set',
  },
];

function getMondayStr(date) {
  const d = new Date(date + 'T00:00:00');
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function formatWeek(weekStart) {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

export default function WeeklyReviewView() {
  const today = new Date().toISOString().slice(0, 10);
  const [weekStart, setWeekStart] = useState(getMondayStr(today));
  const [stepIdx, setStepIdx] = useState(0);
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [stuckCount, setStuckCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [somedayCount, setSomedayCount] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const [inboxRes, stuckRes, waitingRes, somedayRes] = await Promise.all([
        fetch(`${API}/api/inbox/count`),
        fetch(`${API}/api/projects/stuck`),
        fetch(`${API}/api/tasks/waiting`),
        fetch(`${API}/api/tasks/someday`),
      ]);
      const inbox = await inboxRes.json();
      const stuck = await stuckRes.json();
      const waiting = await waitingRes.json();
      const someday = await somedayRes.json();
      setInboxCount(inbox.count || 0);
      setStuckCount(stuck.length || 0);
      setWaitingCount(waiting.length || 0);
      setSomedayCount(someday.length || 0);
    } catch (err) { console.error(err); }
  }, []);

  const fetchReview = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/weekly-review?week_start=${weekStart}`);
      const data = await res.json();
      if (data && data.notes) setNotes(data.notes || '');
      if (data && data.completed_at) setSavedAt(data.completed_at);
      else setSavedAt(null);
    } catch (err) { console.error(err); }
  }, [weekStart]);

  useEffect(() => {
    fetchStats();
    fetchReview();
    setStepIdx(0);
    setChecks({});
  }, [weekStart, fetchStats, fetchReview]);

  const stepStats = {
    inbox: inboxCount > 0 ? `${inboxCount} items remaining` : 'Inbox clear',
    projects: stuckCount > 0 ? `${stuckCount} stuck projects` : 'All projects have next actions',
    waiting: waitingCount > 0 ? `${waitingCount} waiting items` : 'Nothing waiting',
    someday: somedayCount > 0 ? `${somedayCount} someday items` : 'Someday list empty',
  };

  const currentStep = STEPS[stepIdx];
  const allChecked = STEPS.every((s) => checks[s.id]);
  const completedSteps = STEPS.filter((s) => checks[s.id]).length;

  const toggleCheck = (id) => setChecks((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSave = async () => {
    setSaving(true);
    const completedAt = allChecked ? new Date().toISOString() : null;
    try {
      await fetch(`${API}/api/weekly-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart, notes, completed_at: completedAt }),
      });
      setSavedAt(completedAt);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const prevWeek = () => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().slice(0, 10));
  };

  const nextWeek = () => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const next = d.toISOString().slice(0, 10);
    if (next <= getMondayStr(today)) setWeekStart(next);
  };

  return (
    <div className="weekly-review-view">
      <div className="wr-week-nav">
        <button className="wr-nav-btn" onClick={prevWeek}>‹</button>
        <div className="wr-week-label">
          {formatWeek(weekStart)}
          {savedAt && <span className="wr-done-badge"><CheckCircle size={11} /> reviewed</span>}
        </div>
        <button className="wr-nav-btn" onClick={nextWeek} disabled={getMondayStr(today) <= weekStart}>›</button>
      </div>

      <div className="wr-progress-row">
        <div className="wr-progress-label">{completedSteps} / {STEPS.length} steps</div>
        <div className="wr-progress-track">
          <div className="wr-progress-fill" style={{ width: `${(completedSteps / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="wr-layout">
        {/* Step navigator sidebar */}
        <div className="wr-sidebar">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`wr-step-btn${i === stepIdx ? ' wr-step-btn--active' : ''}${checks[s.id] ? ' wr-step-btn--done' : ''}`}
              onClick={() => setStepIdx(i)}
            >
              <span className="wr-step-check">
                {checks[s.id] ? <CheckCircle size={13} /> : <Circle size={13} />}
              </span>
              <span className="wr-step-label">
                {s.title.split(' — ')[1]}
              </span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="wr-content">
          <div className="wr-step-title">{currentStep.title}</div>
          <div className="wr-step-desc">{currentStep.description}</div>

          {stepStats[currentStep.id] && (
            <div className={`wr-stat-chip${stepStats[currentStep.id].includes('remaining') || stepStats[currentStep.id].includes('stuck') || stepStats[currentStep.id].includes('waiting') ? ' wr-stat-chip--warn' : ' wr-stat-chip--ok'}`}>
              {stepStats[currentStep.id]}
            </div>
          )}

          <label className="wr-check-row">
            <input
              type="checkbox"
              checked={!!checks[currentStep.id]}
              onChange={() => toggleCheck(currentStep.id)}
            />
            <span>{currentStep.checkLabel}</span>
          </label>

          {stepIdx === STEPS.length - 1 && (
            <textarea
              className="wr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What are your intentions for next week? What will you focus on? What bold moves are you committing to?"
              rows={5}
            />
          )}

          <div className="wr-step-nav">
            {stepIdx > 0 && (
              <button className="process-btn process-btn--back" onClick={() => setStepIdx(stepIdx - 1)}>
                ← Back
              </button>
            )}
            {stepIdx < STEPS.length - 1 ? (
              <button className="process-btn process-btn--save" onClick={() => setStepIdx(stepIdx + 1)}>
                Next <ChevronRight size={12} />
              </button>
            ) : (
              <button
                className="process-btn process-btn--save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : allChecked ? 'Complete Review' : 'Save Progress'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
