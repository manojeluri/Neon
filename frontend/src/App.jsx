import { API } from './api';
import React, { useState, useEffect, useCallback } from 'react';
import { Sun, CheckSquare, CalendarDays, BarChart2, Inbox, FolderKanban, Target, RefreshCw, Sparkles } from 'lucide-react';
import Calendar from './components/Calendar.jsx';
import TodayView from './components/TodayView.jsx';
import TasksView from './components/TasksView.jsx';
import ReviewView from './components/ReviewView.jsx';
import InboxView from './components/InboxView.jsx';
import ProjectsView from './components/ProjectsView.jsx';
import WeeklyReviewView from './components/WeeklyReviewView.jsx';
import GoalsView from './components/GoalsView.jsx';
import AIView from './components/AIView.jsx';

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function App() {
  const [tab, setTab] = useState('inbox');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [inboxCount, setInboxCount] = useState(0);
  const [taskRefreshKey, setTaskRefreshKey] = useState(0);

  const refreshTasks = () => setTaskRefreshKey((k) => k + 1);

  const today = getTodayStr();

  const refreshInboxCount = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/inbox/count`);
      const data = await res.json();
      setInboxCount(data.count || 0);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { refreshInboxCount(); }, [refreshInboxCount]);

  const TABS = [
    { id: 'inbox',    label: 'Inbox',    icon: Inbox,        badge: inboxCount },
    { id: 'today',    label: 'Today',    icon: Sun },
    { id: 'tasks',    label: 'Tasks',    icon: CheckSquare },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'review',   label: 'Review',   icon: BarChart2 },
    { id: 'weekly',   label: 'Weekly',   icon: RefreshCw },
    { id: 'goals',    label: 'Goals',    icon: Target },
    { id: 'ai',       label: 'AI',       icon: Sparkles },
  ];

  return (
    <>
      <div className="bg-grid">
        <div className="bg-grid-horizon" />
      </div>
      <div className="app">
        <header className="app-header">
          <div className="app-header-left">
            <h1>NEON</h1>
            <div className="date-label">{formatDate(today)}</div>
          </div>
        </header>

        <nav className="tab-nav" aria-label="Main navigation">
          {TABS.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              className={`tab-btn${tab === id ? ' tab-btn--active' : ''}`}
              onClick={() => setTab(id)}
            >
              <span className="tab-btn-inner">
                <Icon size={11} strokeWidth={2} />
                {label}
                {badge > 0 && <span className="tab-badge">{badge}</span>}
              </span>
            </button>
          ))}
        </nav>

        <div style={{ display: tab === 'inbox'    ? 'block' : 'none' }}><InboxView onInboxChange={refreshInboxCount} onTaskCreated={refreshTasks} /></div>
        <div style={{ display: tab === 'today'    ? 'block' : 'none' }}><TodayView /></div>
        <div style={{ display: tab === 'tasks'    ? 'block' : 'none' }}><TasksView refreshKey={taskRefreshKey} /></div>
        <div style={{ display: tab === 'projects' ? 'block' : 'none' }}><ProjectsView /></div>
        <div style={{ display: tab === 'calendar' ? 'block' : 'none' }}>
          <Calendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onNavigateToDayPlanner={() => setTab('today')}
          />
        </div>
        <div style={{ display: tab === 'review'  ? 'block' : 'none' }}><ReviewView /></div>
        <div style={{ display: tab === 'weekly'  ? 'block' : 'none' }}><WeeklyReviewView /></div>
        <div style={{ display: tab === 'goals'   ? 'block' : 'none' }}><GoalsView /></div>
        <div style={{ display: tab === 'ai'      ? 'block' : 'none' }}><AIView /></div>
      </div>
    </>
  );
}
