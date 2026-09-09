import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';

const app = express();
const port = Number(process.env.PORT) || 3001;
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const jwtSecret = process.env.JWT_SECRET || 'adesh-development-secret';
const databaseName = process.env.DB_NAME || 'adesh';
const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: databaseName,
  ssl: {
    minVersion: 'TLSv1.2'
  },
  waitForConnections: true,
  connectionLimit: 10
});
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

async function initializeDatabase() {
const connection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  ssl: {
    minVersion: 'TLSv1.2'
  }
});
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName.replace(/[^a-zA-Z0-9_]/g, '')}\``);
  await connection.end();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id CHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      avatar MEDIUMTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [avatarColumns] = await db.query("SELECT COUNT(*) AS count FROM information_schema.columns WHERE table_schema = ? AND table_name = 'users' AND column_name = 'avatar'", [databaseName]);
  if (!avatarColumns[0].count) await db.query('ALTER TABLE users ADD COLUMN avatar MEDIUMTEXT NULL AFTER password');
  await db.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id VARCHAR(100) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      messages JSON NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'New conversation',
      pinned BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT chats_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS shared_chats (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT 'Shared conversation',
      messages JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT shared_chats_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  const [chatColumns] = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = 'chats'", [databaseName]);
  const chatColumnNames = new Set(chatColumns.map((column) => column.column_name));
  if (!chatColumnNames.has('title')) await db.query("ALTER TABLE chats ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'New conversation' AFTER messages");
  if (!chatColumnNames.has('pinned')) await db.query('ALTER TABLE chats ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE AFTER title');
  console.log(`MySQL persistence enabled (${databaseName})`);
}

app.use(cors());
app.use(express.json({ limit: '12mb' }));

function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;
  try { return jwt.verify(token, jwtSecret); } catch { return null; }
}

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const avatar = typeof req.body.avatar === 'string' && req.body.avatar.startsWith('data:image/') ? req.body.avatar : null;
  if (!email || password.length < 6) return res.status(400).json({ error: 'Use a valid email and a password of at least 6 characters.' });
  if (avatar && avatar.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Profile photo must be smaller than 5 MB.' });
  const [existingRows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  const existing = existingRows[0];
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = { id: crypto.randomUUID(), email, password: await bcrypt.hash(password, 10) };
  await db.query('INSERT INTO users (id, email, password, avatar) VALUES (?, ?, ?, ?)', [user.id, user.email, user.password, avatar]);
  return res.status(201).json({ token: jwt.sign({ id: user.id, email }, jwtSecret, { expiresIn: '7d' }), email, avatar });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const [userRows] = await db.query('SELECT id, email, password, avatar FROM users WHERE email = ?', [email]);
  const user = userRows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  return res.json({ token: jwt.sign({ id: user.id, email }, jwtSecret, { expiresIn: '7d' }), email, avatar: user.avatar });
});

app.get('/api/auth/me', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  const [rows] = await db.query('SELECT email, avatar FROM users WHERE id = ?', [user.id]);
  return rows[0] ? res.json(rows[0]) : res.status(401).json({ error: 'Account not found.' });
});

app.put('/api/profile', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  const email = String(req.body.email || '').trim().toLowerCase();
  const avatar = typeof req.body.avatar === 'string' && req.body.avatar.startsWith('data:image/') ? req.body.avatar : null;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (avatar && avatar.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Profile photo must be smaller than 5 MB.' });
  const [existing] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ?', [email, user.id]);
  if (existing.length) return res.status(409).json({ error: 'That email is already in use.' });
  await db.query('UPDATE users SET email = ?, avatar = COALESCE(?, avatar) WHERE id = ?', [email, avatar, user.id]);
  const token = jwt.sign({ id: user.id, email }, jwtSecret, { expiresIn: '7d' });
  return res.json({ token, email, avatar });
});

app.put('/api/profile/password', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [user.id]);
  if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password))) return res.status(401).json({ error: 'Current password is incorrect.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  await db.query('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(newPassword, 10), user.id]);
  return res.json({ message: 'Password changed successfully.' });
});

app.get('/api/conversations', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.json([]);
  const [chats] = await db.query('SELECT id, messages, title, pinned, updated_at AS updatedAt FROM chats WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC', [user.id]);
  return res.json(chats.map((chat) => ({ ...chat, pinned: Boolean(chat.pinned), messages: typeof chat.messages === 'string' ? JSON.parse(chat.messages) : chat.messages })));
});

app.post('/api/conversations', async (req, res) => {
  const user = getUser(req);
  const { id, messages, title = 'New conversation', pinned = false } = req.body;
  if (!user) return res.status(401).json({ error: 'Sign in to save conversations.' });
  if (!id || !Array.isArray(messages)) return res.status(400).json({ error: 'Conversation data is invalid.' });
  await db.query(
    'INSERT INTO chats (id, user_id, messages, title, pinned) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE messages = VALUES(messages), title = VALUES(title), pinned = VALUES(pinned), updated_at = CURRENT_TIMESTAMP',
    [id, user.id, JSON.stringify(messages), String(title).slice(0, 255), Boolean(pinned)]
  );
  return res.status(204).end();
});

app.patch('/api/conversations/:id', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to edit conversations.' });
  const updates = [];
  const values = [];
  if (typeof req.body.title === 'string' && req.body.title.trim()) { updates.push('title = ?'); values.push(req.body.title.trim().slice(0, 255)); }
  if (typeof req.body.pinned === 'boolean') { updates.push('pinned = ?'); values.push(req.body.pinned); }
  if (!updates.length) return res.status(400).json({ error: 'No conversation changes supplied.' });
  values.push(req.params.id, user.id);
  const [result] = await db.query(`UPDATE chats SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, values);
  return result.affectedRows ? res.json({ ok: true }) : res.status(404).json({ error: 'Conversation not found.' });
});

app.delete('/api/conversations/:id', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Sign in to delete conversations.' });
  const [result] = await db.query('DELETE FROM chats WHERE id = ? AND user_id = ?', [req.params.id, user.id]);
  return result.affectedRows ? res.status(204).end() : res.status(404).json({ error: 'Conversation not found.' });
});

app.post('/api/shares', async (req, res) => {
  const user = getUser(req);
  const { title = 'Shared conversation', messages } = req.body;
  if (!user) return res.status(401).json({ error: 'Sign in to share conversations.' });
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'There is no conversation to share.' });
  const id = crypto.randomUUID();
  await db.query('INSERT INTO shared_chats (id, user_id, title, messages) VALUES (?, ?, ?, ?)', [id, user.id, String(title).slice(0, 255), JSON.stringify(messages)]);
  return res.status(201).json({ id });
});

app.get('/api/shares/:id', async (req, res) => {
  if (!getUser(req)) return res.status(401).json({ error: 'Sign in to open shared conversations.' });
  const [rows] = await db.query('SELECT id, title, messages FROM shared_chats WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Shared conversation not found.' });
  return res.json({ ...rows[0], messages: typeof rows[0].messages === 'string' ? JSON.parse(rows[0].messages) : rows[0].messages });
});

app.post('/api/chat', async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to your .env file.' });
  }

  const { messages, systemInstruction, model, mode = 'general', attachments = [] } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'At least one message is required.' });
  }

  const modeInstructions = {
    general: 'You are Adesh, a thoughtful and concise AI assistant. Use Markdown when it improves readability.',
    marathi: 'You are Adesh, a warm Marathi-first assistant. Reply in Marathi unless the user asks for another language. Use Markdown when useful.',
    coding: 'You are Adesh Code, a senior software engineer. Give practical, maintainable code with concise explanations and Markdown code blocks.',
    business: 'You are Adesh Business, a sharp business advisor. Give structured, practical recommendations with clear next steps.'
  };
  const contents = messages
    .filter((message) => message && typeof message.content === 'string' && message.content.trim())
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content.trim() }]
    }));

  if (!contents.length) {
    return res.status(400).json({ error: 'Your message cannot be empty.' });
  }

  try {
    const latest = contents[contents.length - 1];
    const attachmentParts = Array.isArray(attachments) ? attachments.filter((item) => item?.data && item?.mimeType).slice(0, 3).map((item) => ({ inlineData: { mimeType: item.mimeType, data: item.data } })) : [];
    if (attachmentParts.length) latest.parts.push(...attachmentParts);
    const response = await ai.models.generateContentStream({
      model: model === 'gemini-3.6-flash' ? model : 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction: systemInstruction || modeInstructions[mode] || modeInstructions.general
      }
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    let assistantText = '';
    let hasText = false;
    for await (const chunk of response) {
      const text = chunk.text || '';
      if (text) { hasText = true; assistantText += text; res.write(text); }
    }
    if (!hasText) return res.status(502).end('Gemini returned an empty response. Please try again.');
    const user = getUser(req);
    if (user && req.body.conversationId) {
      const savedUserMessages = messages.map((message, index) => index === messages.length - 1 && attachments.length ? { ...message, attachments: attachments.map((item) => ({ name: item.name, mimeType: item.mimeType })) } : message);
      const savedMessages = [...savedUserMessages, { role: 'assistant', content: assistantText }];
      await db.query(
        'INSERT INTO chats (id, user_id, messages, title, pinned) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE messages = VALUES(messages), title = VALUES(title), updated_at = CURRENT_TIMESTAMP',
        [req.body.conversationId, user.id, JSON.stringify(savedMessages), String(req.body.conversationTitle || 'New conversation').slice(0, 255), Boolean(req.body.pinned)]
      );
    }
    return res.end();
  } catch (error) {
    const status = error?.status || error?.code;
    const message = String(error?.message || '').toLowerCase();
    if (status === 429 || message.includes('rate limit') || message.includes('resource exhausted')) {
      return res.status(429).json({ error: 'You have reached the Gemini rate limit. Please wait a moment and try again.' });
    }
    if (status === 401 || status === 403 || message.includes('api key') || message.includes('permission')) {
      return res.status(401).json({ error: 'The Gemini API key is invalid or does not have access.' });
    }
    console.error('Gemini request failed:', error);
    return res.status(502).json({ error: 'Gemini could not complete that request. Please try again.' });
  }
});

app.use(express.static(path.join(projectRoot, '../dist')));
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(projectRoot, '../dist/index.html'));
});

initializeDatabase()
  .then(() => app.listen(port, () => console.log(`Arc API listening on http://localhost:${port}`)))
  .catch((error) => {
    console.error('MySQL connection failed:', error.message);
    process.exitCode = 1;
  });


