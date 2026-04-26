// Load .env for local development
if (!process.env.TURSO_DATABASE_URL) {
  try { require('dotenv').config(); } catch (_) {}
}

const express = require('express');
const cors = require('cors');
const {
  getTasksForDate, getInboxTasks, getTasksAfterDate, getNowTask,
  getAllActiveTasks,
  getWaitingTasks, getSomedayTasks, getTasksByContext, getAllContexts, getProjectTasks,
  createTask, updateTask, deleteTask,
  getInboxItems, getInboxCount, createInboxItem, deleteInboxItem,
  getProjects, getProjectById, createProject, updateProject, deleteProject, getStuckProjects,
  getGoals, createGoal, updateGoal, deleteGoal,
  getWeeklyReview, upsertWeeklyReview,
  getReviewForDate, upsertReview,
  getMonthSummary,
  getGcalTokens, upsertGcalTokens, deleteGcalTokens,
  getSettingValue, setSettingValue,
  reorderTasks,
} = require('./db');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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
app.use(express.json({ limit: '10mb' })); // large enough for a batch of vault files

// ─── Auth ─────────────────────────────────────────────────────────────────────

const PUBLIC_PATHS = ['/api/auth/login', '/api/health', '/api/gcal/auth', '/api/gcal/callback'];

app.use((req, res, next) => {
  if (PUBLIC_PATHS.some(p => req.path.startsWith(p))) return next();
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-dev-secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(401).json({ error: 'Invalid password' });
  try {
    const hash = await getSettingValue('password_hash');
    if (!hash || !bcrypt.compareSync(password, hash)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    const token = jwt.sign({ user: 'owner' }, process.env.JWT_SECRET || 'fallback-dev-secret', { expiresIn: '30d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

app.get('/api/tasks/active', async (req, res) => {
  try { res.json(await getAllActiveTasks()); }
  catch (err) { res.status(500).json({ error: err?.message || String(err) }); }
});

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

app.put('/api/tasks/reorder', async (req, res) => {
  try {
    const { ordered_ids } = req.body;
    if (!Array.isArray(ordered_ids)) return res.status(400).json({ error: 'ordered_ids must be an array' });
    await reorderTasks(ordered_ids.map(Number));
    res.json({ ok: true });
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

// ─── AI ──────────────────────────────────────────────────────────────────────

const OpenAI = require('openai');
let _openai = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set on the server.');
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

app.post('/api/ai/extract-tasks', async (req, res) => {
  const { files, existingTasks = [], projects = [] } = req.body;
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided.' });
  }

  try {
    const openai = getOpenAI();

    // Pack files into the prompt, stopping at ~60k chars to stay within token budget
    const MAX_CHARS = 60000;
    let combined = '';
    let filesUsed = 0;
    for (const f of files) {
      if (typeof f.name !== 'string' || typeof f.content !== 'string') continue;
      const block = `## ${f.name}\n${f.content.trim()}\n\n`;
      if (combined.length + block.length > MAX_CHARS) break;
      combined += block;
      filesUsed++;
    }

    if (!combined.trim()) {
      return res.status(400).json({ error: 'No readable content in the provided files.' });
    }

    const dedupeSection = existingTasks.length > 0
      ? `\nTASKS ALREADY IN THE SYSTEM — do not suggest these or anything semantically identical:\n${existingTasks.map(t => `- ${t}`).join('\n')}\n`
      : '';

    const projectsSection = projects.length > 0
      ? `\nEXISTING PROJECTS — use these exact names in the "project" field when a task clearly belongs to one, otherwise null:\n${projects.map(p => `- ${p}`).join('\n')}\n`
      : '';

    const systemPrompt = `You are a productivity assistant reading someone's personal notes.
Extract all open loops, commitments, and things the person needs or wants to do.
Return a JSON object with a single key "tasks" — an array of objects.

Each task object must have exactly these fields:
- "title": clear, actionable next action starting with a verb (max 100 chars)
- "priority": "must" (urgent/critical), "should" (normal, default), or "could" (nice to have)
- "context": where this action is best done — one of: "anywhere", "computer", "phone", "errands", "home", "office"
- "project": exact project name from the list below if the task clearly belongs to one, otherwise null

Rules:
- Exclude vague ideas, completed items, and pure observations
- Return 5–30 tasks, no duplicates
- Keep titles concise and actionable${dedupeSection}${projectsSection}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Here are my recent notes:\n\n${combined}\n\nExtract actionable tasks as JSON.` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content);

    const VALID_PRIORITIES = new Set(['must', 'should', 'could']);
    const VALID_CONTEXTS   = new Set(['anywhere', 'computer', 'phone', 'errands', 'home', 'office']);
    const validProjects    = new Set(projects);

    const tasks = Array.isArray(result.tasks)
      ? result.tasks
          .filter(t => t && typeof t.title === 'string' && t.title.trim())
          .map(t => ({
            title:    t.title.trim(),
            priority: VALID_PRIORITIES.has(t.priority) ? t.priority : 'should',
            context:  VALID_CONTEXTS.has(t.context)    ? t.context  : 'anywhere',
            project:  (typeof t.project === 'string' && validProjects.has(t.project)) ? t.project : null,
          }))
      : [];

    res.json({ tasks, files_processed: filesUsed });
  } catch (err) {
    console.error('AI extract error:', err);
    res.status(500).json({ error: err.message || 'AI extraction failed.' });
  }
});

// ─── Google Calendar ──────────────────────────────────────────────────────────

const { google } = require('googleapis');

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://neon-production-a406.up.railway.app/api/gcal/callback'
  );
}

// GET /api/gcal/status — { connected: bool }
app.get('/api/gcal/status', async (req, res) => {
  try {
    const tokens = await getGcalTokens();
    res.json({ connected: !!(tokens?.refresh_token) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gcal/auth — redirect to Google consent screen
app.get('/api/gcal/auth', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set on the server.' });
  }
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
  });
  res.redirect(url);
});

// GET /api/gcal/callback — exchange code for tokens, store, redirect to frontend
app.get('/api/gcal/callback', async (req, res) => {
  const { code, error } = req.query;
  const frontendBase = (process.env.ALLOWED_ORIGINS || '').split(',')[0].trim() || 'http://localhost:5173';
  if (error || !code) return res.redirect(`${frontendBase}?gcal=error`);
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    await upsertGcalTokens({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date:   tokens.expiry_date,
    });
    res.redirect(`${frontendBase}?gcal=connected`);
  } catch (err) {
    console.error('GCal callback error:', err);
    res.redirect(`${frontendBase}?gcal=error`);
  }
});

// GET /api/gcal/events?start=ISO&end=ISO — return events in range
app.get('/api/gcal/events', async (req, res) => {
  try {
    const tokens = await getGcalTokens();
    if (!tokens?.refresh_token) return res.status(401).json({ error: 'Not connected' });

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date:   tokens.expiry_date,
    });

    // Persist refreshed tokens if Google rotates them
    oauth2Client.on('tokens', async (newTokens) => {
      await upsertGcalTokens({
        access_token:  newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expiry_date:   newTokens.expiry_date,
      });
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { start, end } = req.query;

    const response = await calendar.events.list({
      calendarId:   'primary',
      timeMin:      start || new Date().toISOString(),
      timeMax:      end   || new Date(Date.now() + 7 * 86400000).toISOString(),
      singleEvents: true,
      orderBy:      'startTime',
      maxResults:   100,
    });

    const events = (response.data.items || []).map(e => ({
      id:       e.id,
      title:    e.summary || '(No title)',
      start:    e.start?.dateTime || e.start?.date,
      end:      e.end?.dateTime   || e.end?.date,
      allDay:   !e.start?.dateTime,
      location: e.location || null,
      htmlLink: e.htmlLink || null,
    }));

    res.json(events);
  } catch (err) {
    console.error('GCal events error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/gcal/disconnect — remove stored tokens
app.delete('/api/gcal/disconnect', async (req, res) => {
  try {
    await deleteGcalTokens();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export for Vercel / start locally ────────────────────────────────────────

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NEON backend running on http://localhost:${PORT}`);
  });
}
