import { API } from '../api';
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAY_NAMES  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function pad(n) { return String(n).padStart(2, '0'); }

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow)); // shift to Monday
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function getWeekDays(start) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function formatTime(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

function formatWeekRange(start) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(start + 'T00:00:00');
  e.setDate(e.getDate() + 6);
  if (s.getMonth() === e.getMonth())
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
}

function formatDayFull(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function Calendar({ selectedDate, onSelectDate }) {
  const today    = getTodayStr();
  const initDate = selectedDate || today;

  const [calView,   setCalView]   = useState('month');
  const [viewYear,  setViewYear]  = useState(parseInt(initDate.slice(0,4), 10));
  const [viewMonth, setViewMonth] = useState(parseInt(initDate.slice(5,7), 10));
  const [weekStart, setWeekStart] = useState(() => getWeekStart(initDate));
  const [dayDate,   setDayDate]   = useState(initDate);

  const [monthSummary, setMonthSummary] = useState({});
  const [weekTasks,    setWeekTasks]    = useState({});
  const [dayTasks,     setDayTasks]     = useState([]);
  const [loading,      setLoading]      = useState(false);

  // ── Fetch: month summary ────────────────────────────────────────────────────
  useEffect(() => {
    if (calView !== 'month') return;
    fetch(`${API}/api/calendar?year=${viewYear}&month=${viewMonth}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        (data || []).forEach(d => { map[d.date] = d; });
        setMonthSummary(map);
      })
      .catch(() => setMonthSummary({}));
  }, [calView, viewYear, viewMonth]);

  // ── Fetch: week tasks (7 parallel calls) ──────────────────────────────────
  useEffect(() => {
    if (calView !== 'week') return;
    setLoading(true);
    const days = getWeekDays(weekStart);
    Promise.all(
      days.map(d => fetch(`${API}/api/tasks?date=${d}`).then(r => r.json()).catch(() => []))
    ).then(results => {
      const map = {};
      days.forEach((d, i) => { map[d] = Array.isArray(results[i]) ? results[i] : []; });
      setWeekTasks(map);
    }).finally(() => setLoading(false));
  }, [calView, weekStart]);

  // ── Fetch: day tasks ───────────────────────────────────────────────────────
  useEffect(() => {
    if (calView !== 'day') return;
    setLoading(true);
    fetch(`${API}/api/tasks?date=${dayDate}`)
      .then(r => r.json())
      .then(d => setDayTasks(Array.isArray(d) ? d : []))
      .catch(() => setDayTasks([]))
      .finally(() => setLoading(false));
  }, [calView, dayDate]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  function goToToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth() + 1);
    setWeekStart(getWeekStart(today));
    setDayDate(today);
    onSelectDate?.(today);
  }

  function goToDay(dateStr) {
    setDayDate(dateStr);
    onSelectDate?.(dateStr);
    setCalView('day');
  }

  // ── Month grid build ───────────────────────────────────────────────────────
  const firstDow     = new Date(viewYear, viewMonth-1, 1).getDay();
  const daysInMonth  = new Date(viewYear, viewMonth,   0).getDate();
  const daysInPrevMo = new Date(viewYear, viewMonth-1, 0).getDate();
  const leading      = firstDow === 0 ? 6 : firstDow - 1; // Mon-first grid

  const cells = [];
  for (let i = leading - 1; i >= 0; i--) {
    const pm = viewMonth === 1 ? 12 : viewMonth - 1;
    const py = viewMonth === 1 ? viewYear - 1 : viewYear;
    cells.push({ dateStr: `${py}-${pad(pm)}-${pad(daysInPrevMo - i)}`, day: daysInPrevMo - i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: `${viewYear}-${pad(viewMonth)}-${pad(d)}`, day: d, outside: false });
  }
  for (let d = 1; d <= 42 - cells.length; d++) {
    const nm = viewMonth === 12 ? 1 : viewMonth + 1;
    const ny = viewMonth === 12 ? viewYear + 1 : viewYear;
    cells.push({ dateStr: `${ny}-${pad(nm)}-${pad(d)}`, day: d, outside: true });
  }

  const isThisMonth = viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth() + 1;
  const isThisWeek  = getWeekDays(weekStart).includes(today);
  const isDayToday  = dayDate === today;

  return (
    <div className="calendar-container">

      {/* ── View switcher ── */}
      <div className="cal-view-tabs">
        {['month','week','day'].map(v => (
          <button
            key={v}
            className={`cal-view-tab${calView === v ? ' cal-view-tab--active' : ''}`}
            onClick={() => setCalView(v)}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* ══════════════════════ MONTH VIEW ══════════════════════════ */}
      {calView === 'month' && (
        <>
          <div className="calendar-header">
            <button className="cal-nav-btn" onClick={() => {
              if (viewMonth === 1) { setViewYear(y => y-1); setViewMonth(12); }
              else setViewMonth(m => m-1);
            }}><ChevronLeft size={14} /></button>
            <div className="cal-title-group">
              <span className="cal-title">{MONTH_NAMES[viewMonth-1]} {viewYear}</span>
              {!isThisMonth && <button className="cal-today-btn" onClick={goToToday}>Today</button>}
            </div>
            <button className="cal-nav-btn" onClick={() => {
              if (viewMonth === 12) { setViewYear(y => y+1); setViewMonth(1); }
              else setViewMonth(m => m+1);
            }}><ChevronRight size={14} /></button>
          </div>

          <div className="calendar-grid">
            {DAY_NAMES.map(n => <div key={n} className="cal-day-name">{n}</div>)}
            {cells.map(({ dateStr, day, outside }) => {
              const data      = monthSummary[dateStr];
              const taskCount = data?.tasksTotal || 0;
              return (
                <button
                  key={dateStr}
                  className={[
                    'cal-day',
                    outside ? 'cal-day--outside' : '',
                    dateStr === today ? 'cal-day--today' : '',
                    dateStr === selectedDate && !outside ? 'cal-day--selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => goToDay(dateStr)}
                  aria-label={dateStr}
                >
                  <span className="cal-day-num">{day}</span>
                  <div className="cal-day-indicators">
                    {taskCount > 0 && <span className="cal-task-dot" title={`${taskCount} tasks`} />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span className="legend-item">
              <span className="legend-dot" style={{ background: 'var(--accent)' }} /> Tasks
            </span>
          </div>
        </>
      )}

      {/* ══════════════════════ WEEK VIEW ═══════════════════════════ */}
      {calView === 'week' && (
        <>
          <div className="calendar-header">
            <button className="cal-nav-btn" onClick={() => setWeekStart(s => addDays(s, -7))}>
              <ChevronLeft size={14} />
            </button>
            <div className="cal-title-group">
              <span className="cal-title cal-title--sm">{formatWeekRange(weekStart)}</span>
              {!isThisWeek && <button className="cal-today-btn" onClick={goToToday}>Today</button>}
            </div>
            <button className="cal-nav-btn" onClick={() => setWeekStart(s => addDays(s, 7))}>
              <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <div className="cal-week-grid">
              {getWeekDays(weekStart).map((dateStr, i) => {
                const tasks      = weekTasks[dateStr] || [];
                const incomplete = tasks.filter(t => !t.completed);
                const doneCount  = tasks.filter(t =>  t.completed).length;
                const isToday    = dateStr === today;
                const dayNum     = parseInt(dateStr.slice(8), 10);

                return (
                  <div key={dateStr} className={`cal-week-col${isToday ? ' cal-week-col--today' : ''}`}>
                    <button className="cal-week-col-header" onClick={() => goToDay(dateStr)}>
                      <span className="cal-week-day-name">{DAY_NAMES[i]}</span>
                      <span className={`cal-week-day-num${isToday ? ' cal-week-day-num--today' : ''}`}>
                        {dayNum}
                      </span>
                    </button>

                    <div className="cal-week-tasks">
                      {incomplete.length === 0 && doneCount === 0 && (
                        <div className="cal-week-empty">—</div>
                      )}
                      {incomplete
                        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
                        .map(task => (
                          <div key={task.id} className={`cal-week-task${task.priority === 'must' ? ' cal-week-task--must' : ''}`}>
                            {task.time && (
                              <span className="cal-week-task-time">{formatTime(task.time)}</span>
                            )}
                            <span className="cal-week-task-title">{task.title}</span>
                          </div>
                        ))
                      }
                      {doneCount > 0 && (
                        <div className="cal-week-done">{doneCount} done</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════ DAY VIEW ════════════════════════════ */}
      {calView === 'day' && (
        <>
          <div className="calendar-header">
            <button className="cal-nav-btn" onClick={() => setDayDate(d => addDays(d, -1))}>
              <ChevronLeft size={14} />
            </button>
            <div className="cal-title-group">
              <span className="cal-title cal-title--sm">{formatDayFull(dayDate)}</span>
              {!isDayToday && <button className="cal-today-btn" onClick={goToToday}>Today</button>}
            </div>
            <button className="cal-nav-btn" onClick={() => setDayDate(d => addDays(d, 1))}>
              <ChevronRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : (
            <div className="cal-day-view">
              {dayTasks.length === 0 ? (
                <div className="planner-empty" style={{ marginTop: '1rem' }}>
                  No tasks scheduled for this day.
                </div>
              ) : (
                <>
                  {/* Timed tasks — sorted by time */}
                  {dayTasks
                    .filter(t => t.time && !t.completed)
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map(task => (
                      <div key={task.id} className="cal-day-task">
                        <span className="cal-day-task-time">{formatTime(task.time)}</span>
                        <span className="cal-day-task-title">{task.title}</span>
                        {task.priority === 'must' && (
                          <span className="priority-badge priority-must">Must</span>
                        )}
                      </div>
                    ))
                  }

                  {/* Untimed tasks */}
                  {dayTasks
                    .filter(t => !t.time && !t.completed)
                    .map(task => (
                      <div key={task.id} className="cal-day-task">
                        <span className="cal-day-task-time cal-day-task-time--none">—</span>
                        <span className="cal-day-task-title">{task.title}</span>
                        {task.priority === 'must' && (
                          <span className="priority-badge priority-must">Must</span>
                        )}
                      </div>
                    ))
                  }

                  {/* Completed summary */}
                  {dayTasks.filter(t => t.completed).length > 0 && (
                    <div className="cal-day-done">
                      {dayTasks.filter(t => t.completed).length} completed
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

    </div>
  );
}
