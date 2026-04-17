// Use HTTP client — no native binaries, works in Vercel serverless
const { createClient } = require('@libsql/client/http');

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ─── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT,
    time TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    got_done TEXT,
    slipped TEXT,
    wasted_time TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inbox_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    purpose TEXT DEFAULT '',
    outcome TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    horizon TEXT NOT NULL DEFAULT '1year',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weekly_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL UNIQUE,
    notes TEXT DEFAULT '',
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

// Column migrations — silent on "duplicate column" errors
const MIGRATIONS = [
  "ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'should'",
  "ALTER TABLE tasks ADD COLUMN energy TEXT NOT NULL DEFAULT 'light'",
  "ALTER TABLE tasks ADD COLUMN is_top3 INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE tasks ADD COLUMN is_now INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE tasks ADD COLUMN block_type TEXT",
  "ALTER TABLE tasks ADD COLUMN est_minutes INTEGER",
  "ALTER TABLE tasks ADD COLUMN actual_minutes INTEGER",
  "ALTER TABLE tasks ADD COLUMN context TEXT NOT NULL DEFAULT 'anywhere'",
  "ALTER TABLE tasks ADD COLUMN project_id INTEGER",
  "ALTER TABLE tasks ADD COLUMN list_type TEXT NOT NULL DEFAULT 'active'",
  "ALTER TABLE tasks ADD COLUMN waiting_for TEXT",
];

const ready = (async () => {
  await client.executeMultiple(SCHEMA);
  for (const sql of MIGRATIONS) {
    try { await client.execute(sql); } catch (_) {}
  }
})();

// ─── Query helpers ────────────────────────────────────────────────────────────

// Convert libsql Row objects to plain JS objects for safe JSON serialization
const toPlain = (row) => {
  if (!row) return null;
  const obj = {};
  for (const key of Object.keys(row)) obj[key] = row[key];
  return obj;
};

async function all(sql, args = []) {
  await ready;
  const r = await client.execute({ sql, args });
  return r.rows.map(toPlain);
}

async function first(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0] ?? null;
}

async function run(sql, args = []) {
  await ready;
  return client.execute({ sql, args });
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

async function getTasksForDate(date) {
  return all(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.date = ?
     ORDER BY t.is_top3 DESC,
              CASE WHEN t.time IS NULL OR t.time = '' THEN 1 ELSE 0 END,
              t.time ASC, t.id ASC`,
    [date]
  );
}

async function getInboxTasks() {
  return all(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE (t.date IS NULL OR t.date = '') AND t.completed = 0 AND t.list_type = 'active'
     ORDER BY t.priority ASC, t.id ASC`
  );
}

async function getTasksAfterDate(date) {
  return all(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.date > ? AND t.completed = 0
     ORDER BY t.date ASC,
              CASE WHEN t.time IS NULL OR t.time = '' THEN 1 ELSE 0 END,
              t.time ASC, t.id ASC`,
    [date]
  );
}

async function getNowTask() {
  return first('SELECT * FROM tasks WHERE is_now = 1 LIMIT 1');
}

async function getWaitingTasks() {
  return all(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.list_type = 'waiting' AND t.completed = 0
     ORDER BY t.created_at ASC`
  );
}

async function getSomedayTasks() {
  return all(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.list_type = 'someday' AND t.completed = 0
     ORDER BY t.created_at ASC`
  );
}

async function getTasksByContext(context) {
  return all(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.context = ? AND t.list_type = 'active' AND t.completed = 0
     ORDER BY t.priority ASC, t.created_at ASC`,
    [context]
  );
}

async function getAllContexts() {
  return all(
    `SELECT context, COUNT(*) as count FROM tasks
     WHERE list_type = 'active' AND completed = 0
     GROUP BY context ORDER BY count DESC`
  );
}

async function getProjectTasks(projectId) {
  return all(
    `SELECT * FROM tasks WHERE project_id = ?
     ORDER BY list_type ASC, completed ASC, created_at ASC`,
    [projectId]
  );
}

async function createTask(title, description, date, time, extra = {}) {
  const result = await run(
    `INSERT INTO tasks
       (title, description, date, time, priority, energy, block_type, est_minutes,
        context, project_id, list_type, waiting_for)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description || null,
      date || null,
      time || null,
      extra.priority   || 'should',
      extra.energy     || 'light',
      extra.block_type || null,
      extra.est_minutes || null,
      extra.context    || 'anywhere',
      extra.project_id || null,
      extra.list_type  || 'active',
      extra.waiting_for || null,
    ]
  );
  return first(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?`,
    [Number(result.lastInsertRowid)]
  );
}

async function updateTask(id, fields) {
  const allowed = [
    'title', 'description', 'date', 'time', 'completed',
    'priority', 'energy', 'is_top3', 'is_now',
    'block_type', 'est_minutes', 'actual_minutes',
    'context', 'project_id', 'list_type', 'waiting_for',
  ];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));

  if (keys.length === 0) {
    return first(
      `SELECT t.*, p.title as project_title FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?`,
      [id]
    );
  }

  if (fields.is_now === 1 || fields.is_now === true) {
    await run('UPDATE tasks SET is_now = 0 WHERE is_now = 1');
  }

  const setParts = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => {
    if (k === 'completed' || k === 'is_top3' || k === 'is_now') return fields[k] ? 1 : 0;
    return fields[k] !== undefined ? fields[k] : null;
  });
  values.push(id);

  await run(`UPDATE tasks SET ${setParts} WHERE id = ?`, values);
  return first(
    `SELECT t.*, p.title as project_title FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id WHERE t.id = ?`,
    [id]
  );
}

async function deleteTask(id) {
  return run('DELETE FROM tasks WHERE id = ?', [id]);
}

// ─── Inbox Items ──────────────────────────────────────────────────────────────

async function getInboxItems() {
  return all('SELECT * FROM inbox_items ORDER BY created_at DESC');
}

async function getInboxCount() {
  const row = await first('SELECT COUNT(*) as count FROM inbox_items');
  return Number(row.count);
}

async function createInboxItem(content) {
  const result = await run('INSERT INTO inbox_items (content) VALUES (?)', [content]);
  return first('SELECT * FROM inbox_items WHERE id = ?', [Number(result.lastInsertRowid)]);
}

async function deleteInboxItem(id) {
  return run('DELETE FROM inbox_items WHERE id = ?', [id]);
}

// ─── Projects ─────────────────────────────────────────────────────────────────

async function getProjects() {
  return all(
    `SELECT p.*,
       COUNT(CASE WHEN t.completed = 0 AND t.list_type = 'active' THEN 1 END) as active_count,
       COUNT(CASE WHEN t.completed = 0 AND t.list_type = 'waiting' THEN 1 END) as waiting_count,
       COUNT(CASE WHEN t.completed = 1 THEN 1 END) as done_count,
       COUNT(CASE WHEN t.completed = 0 THEN 1 END) as task_count
     FROM projects p
     LEFT JOIN tasks t ON t.project_id = p.id
     GROUP BY p.id
     ORDER BY p.status ASC, p.created_at ASC`
  );
}

async function getProjectById(id) {
  return first('SELECT * FROM projects WHERE id = ?', [id]);
}

async function createProject(title, purpose, outcome) {
  const result = await run(
    'INSERT INTO projects (title, purpose, outcome) VALUES (?, ?, ?)',
    [title, purpose || '', outcome || '']
  );
  return first('SELECT * FROM projects WHERE id = ?', [Number(result.lastInsertRowid)]);
}

async function updateProject(id, fields) {
  const allowed = ['title', 'purpose', 'outcome', 'status'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return first('SELECT * FROM projects WHERE id = ?', [id]);
  const setParts = keys.map((k) => `${k} = ?`).join(', ');
  const values = [...keys.map((k) => fields[k]), id];
  await run(`UPDATE projects SET ${setParts} WHERE id = ?`, values);
  return first('SELECT * FROM projects WHERE id = ?', [id]);
}

async function deleteProject(id) {
  await client.batch([
    { sql: 'UPDATE tasks SET project_id = NULL WHERE project_id = ?', args: [id] },
    { sql: 'DELETE FROM projects WHERE id = ?', args: [id] },
  ], 'write');
}

async function getStuckProjects() {
  return all(
    `SELECT p.* FROM projects p
     WHERE p.status = 'active'
     AND NOT EXISTS (
       SELECT 1 FROM tasks t
       WHERE t.project_id = p.id AND t.completed = 0 AND t.list_type = 'active'
     )
     ORDER BY p.created_at ASC`
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────

async function getGoals() {
  return all(
    `SELECT * FROM goals
     ORDER BY CASE horizon WHEN 'life' THEN 1 WHEN '3year' THEN 2 WHEN '1year' THEN 3 ELSE 4 END,
              created_at ASC`
  );
}

async function createGoal(title, description, horizon) {
  const result = await run(
    'INSERT INTO goals (title, description, horizon) VALUES (?, ?, ?)',
    [title, description || '', horizon || '1year']
  );
  return first('SELECT * FROM goals WHERE id = ?', [Number(result.lastInsertRowid)]);
}

async function updateGoal(id, fields) {
  const allowed = ['title', 'description', 'horizon'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return first('SELECT * FROM goals WHERE id = ?', [id]);
  const setParts = keys.map((k) => `${k} = ?`).join(', ');
  const values = [...keys.map((k) => fields[k]), id];
  await run(`UPDATE goals SET ${setParts} WHERE id = ?`, values);
  return first('SELECT * FROM goals WHERE id = ?', [id]);
}

async function deleteGoal(id) {
  return run('DELETE FROM goals WHERE id = ?', [id]);
}

// ─── Weekly Reviews ───────────────────────────────────────────────────────────

async function getWeeklyReview(weekStart) {
  return first('SELECT * FROM weekly_reviews WHERE week_start = ?', [weekStart]);
}

async function upsertWeeklyReview(weekStart, notes, completedAt) {
  await run(
    `INSERT INTO weekly_reviews (week_start, notes, completed_at) VALUES (?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET
       notes = excluded.notes,
       completed_at = excluded.completed_at`,
    [weekStart, notes || '', completedAt || null]
  );
  return first('SELECT * FROM weekly_reviews WHERE week_start = ?', [weekStart]);
}

// ─── Daily Reviews ────────────────────────────────────────────────────────────

async function getReviewForDate(date) {
  return first('SELECT * FROM reviews WHERE date = ?', [date]);
}

async function upsertReview(date, gotDone, slipped, wastedTime) {
  await run(
    `INSERT INTO reviews (date, got_done, slipped, wasted_time) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       got_done = excluded.got_done,
       slipped = excluded.slipped,
       wasted_time = excluded.wasted_time`,
    [date, gotDone || null, slipped || null, wastedTime || null]
  );
  return first('SELECT * FROM reviews WHERE date = ?', [date]);
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

async function getMonthSummary(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const rows = await all(
    `SELECT date, COUNT(*) as tasksTotal,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as tasksCompleted
     FROM tasks WHERE date LIKE ? GROUP BY date`,
    [`${prefix}-%`]
  );
  return rows
    .map((r) => ({ date: r.date, tasksTotal: Number(r.tasksTotal), tasksCompleted: Number(r.tasksCompleted) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  ready,
  getTasksForDate, getInboxTasks, getTasksAfterDate, getNowTask,
  getWaitingTasks, getSomedayTasks, getTasksByContext, getAllContexts, getProjectTasks,
  createTask, updateTask, deleteTask,
  getInboxItems, getInboxCount, createInboxItem, deleteInboxItem,
  getProjects, getProjectById, createProject, updateProject, deleteProject, getStuckProjects,
  getGoals, createGoal, updateGoal, deleteGoal,
  getWeeklyReview, upsertWeeklyReview,
  getReviewForDate, upsertReview,
  getMonthSummary,
};
