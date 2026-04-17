import React, { useState, useEffect } from 'react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}


export default function Calendar({ selectedDate, onSelectDate, onNavigateToDayPlanner }) {
  const today = getTodayStr();

  // Derive viewYear/viewMonth from selectedDate or today
  const initDate = selectedDate || today;
  const [viewYear, setViewYear] = useState(parseInt(initDate.slice(0, 4), 10));
  const [viewMonth, setViewMonth] = useState(parseInt(initDate.slice(5, 7), 10));
  const [summary, setSummary] = useState({}); // keyed by date string

  useEffect(() => {
    fetch(`/api/calendar?year=${viewYear}&month=${viewMonth}`)
      .then((r) => r.json())
      .then((data) => {
        const map = {};
        (data || []).forEach((d) => { map[d.date] = d; });
        setSummary(map);
      })
      .catch(() => setSummary({}));
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  }

  function goToToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth() + 1);
  }

  // Build the grid cells
  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth - 1, 0).getDate();

  const cells = [];

  // Leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonth_ = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevYear_ = viewMonth === 1 ? viewYear - 1 : viewYear;
    cells.push({
      dateStr: `${prevYear_}-${pad(prevMonth_)}-${pad(day)}`,
      day,
      outside: true,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      dateStr: `${viewYear}-${pad(viewMonth)}-${pad(d)}`,
      day: d,
      outside: false,
    });
  }

  // Trailing days to fill the grid (always 6 rows = 42 cells)
  const trailing = 42 - cells.length;
  for (let d = 1; d <= trailing; d++) {
    const nextMonth_ = viewMonth === 12 ? 1 : viewMonth + 1;
    const nextYear_ = viewMonth === 12 ? viewYear + 1 : viewYear;
    cells.push({
      dateStr: `${nextYear_}-${pad(nextMonth_)}-${pad(d)}`,
      day: d,
      outside: true,
    });
  }

  function handleDayClick(dateStr, outside) {
    // If outside day, navigate to that month first
    if (outside) {
      const y = parseInt(dateStr.slice(0, 4), 10);
      const m = parseInt(dateStr.slice(5, 7), 10);
      setViewYear(y);
      setViewMonth(m);
    }
    onSelectDate(dateStr);
    onNavigateToDayPlanner();
  }

  const isCurrentMonth = viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth() + 1;

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button className="cal-nav-btn" onClick={prevMonth} aria-label="Previous month">&#8249;</button>
        <div className="cal-title-group">
          <span className="cal-title">{MONTH_NAMES[viewMonth - 1]} {viewYear}</span>
          {!isCurrentMonth && (
            <button className="cal-today-btn" onClick={goToToday}>Today</button>
          )}
        </div>
        <button className="cal-nav-btn" onClick={nextMonth} aria-label="Next month">&#8250;</button>
      </div>

      <div className="calendar-grid">
        {DAY_NAMES.map((name) => (
          <div key={name} className="cal-day-name">{name}</div>
        ))}

        {cells.map(({ dateStr, day, outside }) => {
          const data = summary[dateStr];
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;

          const hasTasks = data && data.tasksTotal > 0;

          const classes = [
            'cal-day',
            outside ? 'cal-day--outside' : '',
            isToday ? 'cal-day--today' : '',
            isSelected && !outside ? 'cal-day--selected' : '',
          ].filter(Boolean).join(' ');

          return (
            <button
              key={dateStr}
              className={classes}
              onClick={() => handleDayClick(dateStr, outside)}
              aria-label={`${dateStr}${isToday ? ' (today)' : ''}`}
            >
              <span className="cal-day-num">{day}</span>

              <div className="cal-day-indicators">
                {hasTasks && (
                  <span
                    className="cal-task-dot"
                    title={`${data.tasksTotal} task${data.tasksTotal !== 1 ? 's' : ''}`}
                  />
                )}
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
    </div>
  );
}
