// Load .env for local development
if (!process.env.TURSO_DATABASE_URL) {
  try { require('dotenv').config({ path: require('path').join(__dirname, '../.env') }); } catch (_) {}
}

const express = require('express');
const cors = require('cors');
const {
  getTasksForDate, getInboxTasks, getTasksAfterDate, getNowTask,
  getWaitingTasks, getSomedayTasks, getTasksByContext, getAllContexts, getProjectTasks,
  createTask, updateTask, deleteTask,
  getInboxItems, getInboxCount, createInboxItem, deleteInboxItem,
  getProjects, getProjectById, createProject, updateProject, deleteProject, getStuckProjects,
  getGoals, createGoal, updateGoal, deleteGoal,
  getWeeklyReview, upsertWeeklyReview,
  getReviewForDate, upsertReview,
  getMonthSummary,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (curl, mobile apps) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    const { ready } = require('./db');
    await ready;
    res.json({ ok: true, turso_url: process.env.TURSO_DATABASE_URL ? 'set' : 'MISSING' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), turso_url: process.env.TURSO_DATABASE_URL ? 'set' : 'MISSING' });
  }
});

// ─── Inbox Items ──────────────────────────────────────────────────────────────

app.get('/api/inbox', async (req, res) => {
  try { res.json(await getInboxItems()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/inbox/count', async (req, res) => {
  try { res.json({ count: await getInboxCount() }); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.post('/api/inbox', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content is required' });
    res.status(201).json(await createInboxItem(content.trim()));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.delete('/api/inbox/:id', async (req, res) => {
  try { await deleteInboxItem(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

// ─── Projects ─────────────────────────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  try { res.json(await getProjects()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/projects/stuck', async (req, res) => {
  try { res.json(await getStuckProjects()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProjectById(parseInt(req.params.id, 10));
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/projects/:id/tasks', async (req, res) => {
  try { res.json(await getProjectTasks(parseInt(req.params.id, 10))); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { title, purpose, outcome } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    res.status(201).json(await createProject(title.trim(), purpose, outcome));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, purpose, outcome, status } = req.body;
    const fields = {};
    if (title !== undefined)   fields.title   = title.trim();
    if (purpose !== undefined) fields.purpose = purpose;
    if (outcome !== undefined) fields.outcome = outcome;
    if (status !== undefined)  fields.status  = status;
    res.json(await updateProject(id, fields));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.delete('/api/projects/:id', async (req, res) => {
  try { await deleteProject(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

// ─── Goals ────────────────────────────────────────────────────────────────────

app.get('/api/goals', async (req, res) => {
  try { res.json(await getGoals()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.post('/api/goals', async (req, res) => {
  try {
    const { title, description, horizon } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const valid = ['1year', '3year', 'life'];
    if (horizon && !valid.includes(horizon)) return res.status(400).json({ error: 'Invalid horizon' });
    res.status(201).json(await createGoal(title.trim(), description, horizon));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.put('/api/goals/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, horizon } = req.body;
    const fields = {};
    if (title !== undefined)       fields.title       = title.trim();
    if (description !== undefined) fields.description = description;
    if (horizon !== undefined)     fields.horizon     = horizon;
    res.json(await updateGoal(id, fields));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.delete('/api/goals/:id', async (req, res) => {
  try { await deleteGoal(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

app.get('/api/tasks/inbox', async (req, res) => {
  try { res.json(await getInboxTasks()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/tasks/now', async (req, res) => {
  try { res.json(await getNowTask()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/tasks/waiting', async (req, res) => {
  try { res.json(await getWaitingTasks()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/tasks/someday', async (req, res) => {
  try { res.json(await getSomedayTasks()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/tasks/contexts', async (req, res) => {
  try {
    const { context } = req.query;
    res.json(context ? await getTasksByContext(context) : await getAllContexts());
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/tasks/later', async (req, res) => {
  try {
    const { after } = req.query;
    if (!after) return res.status(400).json({ error: 'after query param is required' });
    res.json(await getTasksAfterDate(after));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required' });
    res.json(await getTasksForDate(date));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const {
      title, description, date, time, priority, energy,
      block_type, est_minutes, context, project_id, list_type, waiting_for,
    } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    const task = await createTask(title.trim(), description, date, time || null, {
      priority, energy, block_type, est_minutes,
      context, project_id, list_type, waiting_for,
    });
    res.status(201).json(task);
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      title, description, date, time, completed,
      priority, energy, is_top3, is_now,
      block_type, est_minutes, actual_minutes,
      context, project_id, list_type, waiting_for,
    } = req.body;

    const fields = {};
    if (title !== undefined)          fields.title          = title.trim();
    if (description !== undefined)    fields.description    = description;
    if (date !== undefined)           fields.date           = date;
    if (time !== undefined)           fields.time           = time || null;
    if (completed !== undefined)      fields.completed      = completed;
    if (priority !== undefined)       fields.priority       = priority;
    if (energy !== undefined)         fields.energy         = energy;
    if (is_top3 !== undefined)        fields.is_top3        = is_top3;
    if (is_now !== undefined)         fields.is_now         = is_now;
    if (block_type !== undefined)     fields.block_type     = block_type || null;
    if (est_minutes !== undefined)    fields.est_minutes    = est_minutes || null;
    if (actual_minutes !== undefined) fields.actual_minutes = actual_minutes || null;
    if (context !== undefined)        fields.context        = context;
    if (project_id !== undefined)     fields.project_id     = project_id || null;
    if (list_type !== undefined)      fields.list_type      = list_type;
    if (waiting_for !== undefined)    fields.waiting_for    = waiting_for || null;

    // Enforce top3 limit (max 3 per date)
    if (fields.is_top3 === 1 || fields.is_top3 === true) {
      const task = await updateTask(id, {});
      const currentDate = task ? task.date : null;
      if (currentDate) {
        const dayTasks = await getTasksForDate(currentDate);
        const top3Count = dayTasks.filter((t) => t.is_top3 && t.id !== id).length;
        if (top3Count >= 3) {
          return res.status(400).json({ error: 'Top 3 is full. Remove one first.' });
        }
      }
    }

    res.json(await updateTask(id, fields));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try { await deleteTask(parseInt(req.params.id, 10)); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

app.get('/api/review', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param is required' });
    res.json(await getReviewForDate(date) || {});
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.put('/api/review', async (req, res) => {
  try {
    const { date, got_done, slipped, wasted_time } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required' });
    res.json(await upsertReview(date, got_done, slipped, wasted_time));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

// ─── Weekly Reviews ───────────────────────────────────────────────────────────

app.get('/api/weekly-review', async (req, res) => {
  try {
    const { week_start } = req.query;
    if (!week_start) return res.status(400).json({ error: 'week_start query param required' });
    res.json(await getWeeklyReview(week_start) || {});
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

app.put('/api/weekly-review', async (req, res) => {
  try {
    const { week_start, notes, completed_at } = req.body;
    if (!week_start) return res.status(400).json({ error: 'week_start is required' });
    res.json(await upsertWeeklyReview(week_start, notes, completed_at));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

// ─── Calendar ─────────────────────────────────────────────────────────────────

app.get('/api/calendar', async (req, res) => {
  try {
    const year  = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'year and month (1–12) are required' });
    }
    res.json(await getMonthSummary(year, month));
  } catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

// ─── Export for Vercel / start locally ────────────────────────────────────────

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NEON backend running on http://localhost:${PORT}`);
  });
}
