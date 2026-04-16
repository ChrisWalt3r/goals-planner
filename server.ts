import express from 'express';
import { createServer as createViteServer } from 'vite';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'cloud-planner-secret-key';
const db = new Database('planner.db');
db.pragma('foreign_keys = ON');

const HOST = process.env.HOST || '0.0.0.0';
const START_PORT = Number.parseInt(process.env.PORT ?? '', 10) || 3000;

const isPortAvailable = (port: number, host: string) => {
  return new Promise<boolean>((resolve) => {
    const tester = net.createServer();

    tester.unref();
    tester.once('error', () => {
      resolve(false);
    });
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, host);
  });
};

const findAvailablePort = async (startPort: number, host: string) => {
  for (let port = startPort; port < startPort + 25; port += 1) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  throw new Error(`Unable to find an available port starting at ${startPort}`);
};

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    parent_id TEXT,
    type TEXT NOT NULL, -- 'area', 'goal', 'project', 'task'
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'not-started', -- 'not-started', 'in-progress', 'completed'
    progress INTEGER DEFAULT 0,
    deadline DATETIME,
    position_x REAL,
    position_y REAL,
    tags TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id TEXT NOT NULL,
    content TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
  );
`);

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json());

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      
      const dbUser = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
      if (!dbUser) return res.sendStatus(403);

      req.user = user;
      next();
    });
  };

  // Auth Routes
  app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
      const result = stmt.run(email, hashedPassword);
      const token = jwt.sign({ id: result.lastInsertRowid, email }, JWT_SECRET);
      res.json({ token, user: { id: result.lastInsertRowid, email } });
    } catch (error) {
      res.status(400).json({ error: 'User already exists or invalid data' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email } });
  });

  // Helper to update parent progress recursively
  const updateParentProgress = (parentId: string | null, userId: number) => {
    if (!parentId) return;

    const parent: any = db.prepare('SELECT * FROM nodes WHERE id = ? AND user_id = ?').get(parentId, userId);
    if (!parent) return;

    const children = db.prepare('SELECT * FROM nodes WHERE parent_id = ? AND user_id = ?').all(parentId, userId) as any[];
    
    let newProgress = parent.progress;
    let newStatus = parent.status;

    if (parent.type === 'project') {
      const tasks = children.filter((c: any) => c.type === 'task');
      const projects = children.filter((c: any) => c.type === 'project');
      
      if (tasks.length > 0 || projects.length > 0) {
        let totalItems = tasks.length + projects.length;
        let completedItems = tasks.filter((t: any) => t.status === 'completed').length;
        let inProgressItems = tasks.filter((t: any) => t.status === 'in-progress').length;
        let totalProgress = 0;

        for (const t of tasks) {
          totalProgress += (t.status === 'completed' ? 100 : 0);
        }
        for (const p of projects) {
          totalProgress += (p.progress || 0);
          if (p.status === 'completed') completedItems++;
          if (p.status === 'in-progress' || (p.progress > 0 && p.progress < 100)) inProgressItems++;
        }

        newProgress = Math.round(totalProgress / totalItems);
        
        if (newProgress === 100) {
          newStatus = 'completed';
        } else if (inProgressItems > 0 || (completedItems > 0 && completedItems < totalItems)) {
          newStatus = 'in-progress';
        } else if (completedItems === 0 && inProgressItems === 0) {
          newStatus = 'not-started';
        }

        db.prepare('UPDATE nodes SET progress = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newProgress, newStatus, parent.id);
        updateParentProgress(parent.parent_id, userId);
      }
    } else if (parent.type === 'area') {
      const goals = children.filter((c: any) => c.type === 'goal');
      if (goals.length > 0) {
        let anyInProgress = false;
        let allNotStarted = true;
        let allCompleted = true;

        for (const g of goals) {
          if (g.status === 'in-progress' || (g.progress > 0 && g.progress < 100)) anyInProgress = true;
          if (g.status !== 'not-started') allNotStarted = false;
          if (g.status === 'completed') {
            // allCompleted stays true if it was true
          } else {
            allCompleted = false;
          }
        }

        if (allCompleted) {
          newStatus = 'completed';
        } else if (anyInProgress || !allNotStarted) {
          newStatus = 'in-progress';
        } else {
          newStatus = 'not-started';
        }

        db.prepare('UPDATE nodes SET status = ?, deadline = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, parent.id);
      }
    } else if (parent.type === 'goal') {
      const projects = children.filter((c: any) => c.type === 'project');
      if (projects.length > 0) {
        let totalProgress = 0;
        let anyInProgress = false;
        let allNotStarted = true;

        for (const p of projects) {
          totalProgress += (p.progress || 0);
          if (p.status === 'in-progress' || (p.progress > 0 && p.progress < 100)) anyInProgress = true;
          if (p.status !== 'not-started') allNotStarted = false;
        }
        newProgress = Math.round(totalProgress / projects.length);

        if (newProgress === 100) {
          newStatus = 'completed';
        } else if (anyInProgress || (newProgress > 0 && newProgress < 100)) {
          newStatus = 'in-progress';
        } else if (allNotStarted && newProgress === 0) {
          newStatus = 'not-started';
        }

        db.prepare('UPDATE nodes SET progress = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newProgress, newStatus, parent.id);
        updateParentProgress(parent.parent_id, userId);
      }
    }
  };

  // Node Routes
  app.get('/api/nodes', authenticateToken, (req: any, res) => {
    const nodes = db.prepare('SELECT * FROM nodes WHERE user_id = ?').all(req.user.id);
    res.json(nodes.map((n: any) => ({ ...n, tags: JSON.parse(n.tags || '[]') })));
  });

  app.post('/api/nodes', authenticateToken, (req: any, res) => {
    const { id, parent_id, type, title, description, status, progress, deadline, position_x, position_y, tags } = req.body;
    const stmt = db.prepare(`
      INSERT INTO nodes (id, user_id, parent_id, type, title, description, status, progress, deadline, position_x, position_y, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, req.user.id, parent_id, type, title, description, status, progress, deadline, position_x, position_y, JSON.stringify(tags || []));
    
    updateParentProgress(parent_id, req.user.id);
    
    res.json({ success: true });
  });

  app.put('/api/nodes/:id', authenticateToken, (req: any, res) => {
    const { title, description, status, progress, deadline, position_x, position_y, tags, parent_id } = req.body;
    
    // Get old parent to update it too if it changed
    const oldNode: any = db.prepare('SELECT parent_id FROM nodes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    const stmt = db.prepare(`
      UPDATE nodes 
      SET title = ?, description = ?, status = ?, progress = ?, deadline = ?, position_x = ?, position_y = ?, tags = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);
    stmt.run(title, description, status, progress, deadline, position_x, position_y, JSON.stringify(tags || []), parent_id, req.params.id, req.user.id);
    
    updateParentProgress(parent_id, req.user.id);
    if (oldNode && oldNode.parent_id !== parent_id) {
      updateParentProgress(oldNode.parent_id, req.user.id);
    }

    res.json({ success: true });
  });

  app.delete('/api/nodes/:id', authenticateToken, (req: any, res) => {
    const node: any = db.prepare('SELECT parent_id FROM nodes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    db.prepare('DELETE FROM nodes WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    
    if (node) {
      updateParentProgress(node.parent_id, req.user.id);
    }
    
    res.json({ success: true });
  });

  // Notes Routes
  app.get('/api/notes/:nodeId', authenticateToken, (req: any, res) => {
    const note = db.prepare('SELECT * FROM notes WHERE node_id = ?').get(req.params.nodeId);
    res.json(note || { content: '' });
  });

  app.post('/api/notes/:nodeId', authenticateToken, (req: any, res) => {
    const { content } = req.body;
    const existing = db.prepare('SELECT id FROM notes WHERE node_id = ?').get(req.params.nodeId);
    if (existing) {
      db.prepare('UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE node_id = ?').run(content, req.params.nodeId);
    } else {
      db.prepare('INSERT INTO notes (node_id, content) VALUES (?, ?)').run(req.params.nodeId, content);
    }
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get('/api/stats', authenticateToken, (req: any, res) => {
    const total = db.prepare('SELECT COUNT(*) as count FROM nodes WHERE user_id = ?').get(req.user.id) as any;
    const completed = db.prepare("SELECT COUNT(*) as count FROM nodes WHERE user_id = ? AND status = 'completed'").get(req.user.id) as any;
    const inProgress = db.prepare("SELECT COUNT(*) as count FROM nodes WHERE user_id = ? AND status = 'in-progress'").get(req.user.id) as any;
    
    res.json({
      total: total.count,
      completed: completed.count,
      inProgress: inProgress.count,
      overallProgress: total.count > 0 ? Math.round((completed.count / total.count) * 100) : 0
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = await findAvailablePort(START_PORT, HOST);

  server.listen(port, HOST, () => {
    const hostLabel = HOST === '0.0.0.0' ? 'localhost' : HOST;
    if (port !== START_PORT) {
      console.log(`Port ${START_PORT} was busy, using http://${hostLabel}:${port}`);
      return;
    }

    console.log(`Server running on http://${hostLabel}:${port}`);
  });
}

startServer();
