import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  LogIn,
  LogOut,
  Mic,
  Paperclip,
  Menu,
  MessageSquarePlus,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Settings,
  Search,
  Sparkles,
  Sun,
  Volume2,
  Trash2,
  X,
  Zap
} from 'lucide-react';
import './styles.css';

const STORAGE_KEY = 'arc-chat-conversations';
const SETTINGS_KEY = 'arc-chat-settings';
const uid = () => crypto.randomUUID();

const suggestions = [
  { label: 'Explain a topic', text: 'Explain a complex topic in a simple, memorable way.' },
  { label: 'Write code', text: 'Help me write clean, production-ready code for ' },
  { label: 'Write an email', text: 'Draft a polished email about ' },
  { label: 'Summarize text', text: 'Summarize the following text and pull out the key takeaways:\n\n' }
];

function makeConversation() {
  return { id: uid(), title: 'New conversation', createdAt: Date.now(), messages: [] };
}

function normalizeConversation(conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const firstUserMessage = messages.find((message) => message.role === 'user');
  return { ...conversation, pinned: Boolean(conversation.pinned), title: conversation.title || firstUserMessage?.content?.slice(0, 34) || 'New conversation', messages };
}

function loadConversations() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : [makeConversation()];
  } catch {
    return [makeConversation()];
  }
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    return { theme: 'light', model: 'gemini-3.6-flash', compact: false, ...saved, model: 'gemini-3.6-flash' };
  } catch {
    return { theme: 'light', model: 'gemini-3.6-flash', compact: false };
  }
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp);
}

function CodeBlock({ inline, className, children, ...props }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') || 'code';
  const code = String(children).replace(/\n$/, '');
  if (inline) return <code className="inline-code" {...props}>{children}</code>;
  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="code-wrap">
      <div className="code-header"><span>{language}</span><button onClick={copyCode} title="Copy code">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy code'}</button></div>
      <pre><code {...props}>{code}</code></pre>
    </div>
  );
}

function Markdown({ content }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{content}</ReactMarkdown>;
}

function Message({ message, onRegenerate, onSpeak, isLast }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const isAssistant = message.role === 'assistant';
  return (
    <article className={`message-row ${isAssistant ? 'assistant-row' : 'user-row'}`}>
      <div className={`avatar ${isAssistant ? 'assistant-avatar' : 'user-avatar'}`}>{isAssistant ? <Sparkles size={15} /> : 'YO'}</div>
      <div className="message-column">
        <div className="message-meta"><strong>{isAssistant ? 'Adesh' : 'You'}</strong><span>{formatTime(message.createdAt)}</span></div>
        <div className={`message-bubble ${isAssistant ? 'assistant-bubble' : 'user-bubble'}`}>
          {isAssistant ? <Markdown content={message.content} /> : <p>{message.content}</p>}
        </div>
        {isAssistant && <div className="message-actions">
          <button onClick={copy} title="Copy response">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button>
          <button onClick={() => onSpeak(message.content)} title="Read response aloud"><Volume2 size={14} /> Listen</button>
          {isLast && <button onClick={onRegenerate} title="Regenerate response"><RefreshCw size={14} /> Regenerate</button>}
        </div>}
      </div>
    </article>
  );
}

function TypingIndicator() {
  return <div className="typing-row"><div className="avatar assistant-avatar"><Sparkles size={15} /></div><div className="typing-bubble"><span /><span /><span /></div></div>;
}

function UserAvatar({ auth, className = 'profile-avatar' }) {
  return auth?.avatar ? <img className={`${className} profile-photo`} src={auth.avatar} alt="Profile" /> : <div className={className}>{auth?.email?.[0]?.toUpperCase() || 'A'}</div>;
}

function BrandLogo({ full = false, className = '' }) {
  return <img className={className} src={full ? '/chatbot-logo.svg' : '/chatbot-icon.svg'} alt="ChatBot logo" />;
}

function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename, onPin, onSettings, mobileOpen, onClose, auth, onAuth, onLogout, search, setSearch }) {
  return <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
    <div className="sidebar-top"><div className="brand"><BrandLogo className="brand-logo" /><span>Adesh</span>{auth?.avatar && <UserAvatar auth={auth} className="brand-avatar" />}</div><button className="icon-button close-mobile" onClick={onClose}><X size={18} /></button></div>
    <button className="new-chat" onClick={onNew}><MessageSquarePlus size={17} /> New chat <span>⌘ K</span></button>
    <div className="history-heading"><span>Conversations</span><span className="history-count">{conversations.length}</span></div><label className="conversation-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" /></label>
    <div className="conversation-list">
      {conversations.filter((conversation) => conversation.title.toLowerCase().includes(search.toLowerCase())).map((conversation) => <div key={conversation.id} className={`conversation-item ${conversation.id === activeId ? 'active' : ''}`}><button onClick={() => { onSelect(conversation.id); onClose(); }}><span className="conversation-icon">{conversation.pinned ? <Pin size={14} /> : <MessageSquarePlus size={14} />}</span><span className="conversation-title">{conversation.title}</span></button><button className="conversation-action" title="Rename conversation" onClick={() => onRename(conversation)}><Pencil size={13} /></button><button className="conversation-action" title="Pin conversation" onClick={() => onPin(conversation)}><Pin size={13} /></button><button className="delete-button" title="Delete conversation" onClick={() => onDelete(conversation.id)}><Trash2 size={14} /></button></div>)}
    </div>
    <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-icon"><Zap size={15} /></div><div><strong>Adesh Plus</strong><span>More room to think</span></div><ChevronDown size={15} /></div><button className="settings-button" onClick={onSettings}><Settings size={17} /> Settings <span>⌘ ,</span></button><button className="profile" onClick={auth ? onLogout : onAuth}><UserAvatar auth={auth} /><div><strong>{auth ? auth.email : 'Sign in to Adesh'}</strong><span>{auth ? 'Synced workspace' : 'Save your history'}</span></div>{auth ? <LogOut size={16} /> : <LogIn size={16} />}</button></div>
  </aside>;
}

function SettingsPanel({ settings, setSettings, onClose }) {
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  return <div className="settings-panel"><div className="settings-header"><div><span className="eyebrow">Workspace</span><h2>Settings</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div><div className="settings-group"><span className="settings-label">Appearance</span><div className="theme-options"><button className={settings.theme === 'light' ? 'selected' : ''} onClick={() => update('theme', 'light')}><Sun size={16} /> Light</button><button className={settings.theme === 'dark' ? 'selected' : ''} onClick={() => update('theme', 'dark')}><Moon size={16} /> Dark</button></div></div><div className="settings-group"><span className="settings-label">Response model</span><div className="select-field"><select value="gemini-3.6-flash" onChange={(event) => update('model', event.target.value)}><option value="gemini-3.6-flash">Gemini 3.6 Flash</option></select><ChevronDown size={15} /></div></div><div className="settings-group setting-row"><div><span className="settings-label">Compact messages</span><small>Use tighter spacing in conversations</small></div><button className={`toggle ${settings.compact ? 'on' : ''}`} onClick={() => update('compact', !settings.compact)}><span /></button></div><div className="settings-note"><Bot size={17} /><p>Your preferences are saved locally in this browser.</p></div></div>;
}

function AuthPanel({ onClose, onAuth, authError, forceLogin = false, forceRegister = false }) {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (forceRegister) setRegistering(true); else if (forceLogin) setRegistering(false); }, [forceLogin, forceRegister]);
  const submit = async () => {
    setSubmitting(true);
    await onAuth({ email, password, registering, avatar });
    setSubmitting(false);
  };
  const handleAvatar = (event) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return; if (file.size > 4 * 1024 * 1024) return; const reader = new FileReader(); reader.onload = () => setAvatar(String(reader.result)); reader.readAsDataURL(file); };
  return <div className={`auth-panel ${forceLogin || forceRegister ? 'auth-page' : ''}`}><div className="auth-card">{!forceLogin && !forceRegister && <button className="icon-button auth-close" onClick={onClose} disabled={submitting}><X size={18} /></button>}<BrandLogo full className="auth-logo" /><div className="welcome-mark auth-mark">{registering && avatar ? <img className="auth-photo-preview" src={avatar} alt="Profile preview" /> : <Sparkles size={22} />}</div><span className="eyebrow">Adesh workspace</span><h2>{registering ? 'Create your account' : 'Welcome back'}</h2><p>{registering ? 'Save your conversations and pick up anywhere.' : 'Sign in to sync your conversations securely.'}</p><form onSubmit={(event) => { event.preventDefault(); submit(); }}><input type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={submitting} /><input type="password" placeholder="Password (6+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} minLength="6" required disabled={submitting} />{registering && <label className="photo-upload">{avatar ? 'Change profile photo' : 'Upload profile photo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatar} disabled={submitting} /></label>}{authError && <div className="auth-error">{authError}</div>}<button className="auth-submit" type="submit" disabled={submitting}><LogIn size={16} /> {submitting ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}</button></form><button className="auth-switch" onClick={() => setRegistering(!registering)} disabled={submitting}>{registering ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></div></div>;
}

function ProfileSettings({ auth, onAuthUpdate, showToast }) {
  const [email, setEmail] = useState(auth?.email || '');
  const [avatar, setAvatar] = useState(auth?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const choosePhoto = (event) => { const file = event.target.files?.[0]; if (!file || !file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) return; const reader = new FileReader(); reader.onload = () => setAvatar(String(reader.result)); reader.readAsDataURL(file); };
  const saveProfile = async (event) => { event.preventDefault(); setSaving(true); const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ email, avatar }) }); const data = await response.json().catch(() => ({})); setSaving(false); if (!response.ok) return showToast(data.error || 'Could not update profile.'); onAuthUpdate(data); showToast('Profile updated'); };
  const savePassword = async (event) => { event.preventDefault(); setSaving(true); const response = await fetch('/api/profile/password', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ currentPassword, newPassword }) }); const data = await response.json().catch(() => ({})); setSaving(false); if (!response.ok) return showToast(data.error || 'Could not change password.'); setCurrentPassword(''); setNewPassword(''); showToast('Password changed'); };
  return <div className="profile-settings"><div className="settings-group"><span className="settings-label">Profile</span><form className="profile-form" onSubmit={saveProfile}><div className="profile-edit-row">{avatar ? <img className="profile-edit-photo" src={avatar} alt="Profile" /> : <div className="profile-edit-photo profile-edit-fallback">{email[0]?.toUpperCase() || 'A'}</div>}<label className="photo-upload">Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} disabled={saving} /></label></div><input className="profile-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><button className="auth-submit profile-save" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button></form></div><div className="settings-group"><span className="settings-label">Change password</span><form className="profile-form" onSubmit={savePassword}><input className="profile-input" type="password" placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /><input className="profile-input" type="password" placeholder="New password (6+ characters)" minLength="6" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /><button className="auth-submit profile-save" disabled={saving}>{saving ? 'Saving...' : 'Change password'}</button></form></div></div>;
}

function App() {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(() => conversations[0]?.id);
  const [settings, setSettings] = useState(loadSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState('general');
  const [attachments, setAttachments] = useState([]);
  const [documentQuery, setDocumentQuery] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [forceLogin, setForceLogin] = useState(() => !localStorage.getItem('adesh-auth'));
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('adesh-auth') || 'null'));
  const [authError, setAuthError] = useState('');
  const [recording, setRecording] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeConversation = conversations.find((item) => item.id === activeId) || conversations[0];
  const messages = activeConversation?.messages || [];

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)), [conversations]);
  useEffect(() => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)), [settings]);
  useEffect(() => { if (auth) localStorage.setItem('adesh-auth', JSON.stringify(auth)); else localStorage.removeItem('adesh-auth'); }, [auth]);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);
  useEffect(() => {
    if (!auth?.token) return;
    const headers = { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' };
    const localConversations = conversations.filter((conversation) => conversation.messages.length);
    Promise.all(localConversations.map((conversation) => fetch('/api/conversations', {
      method: 'POST', headers, body: JSON.stringify({ id: conversation.id, messages: conversation.messages })
    })))
      .then(() => fetch('/api/conversations', { headers }))
      .then((response) => response.ok ? response.json() : [])
      .then((remoteConversations) => {
        if (!Array.isArray(remoteConversations) || !remoteConversations.length) {
          const fresh = makeConversation();
          setConversations([fresh]);
          setActiveId(fresh.id);
          return;
        }
        const loaded = remoteConversations.map(normalizeConversation);
        setConversations(loaded);
        setActiveId(loaded[0].id);
      })
      .catch(() => {
        const fresh = makeConversation();
        setConversations([fresh]);
        setActiveId(fresh.id);
      });
  }, [auth?.token]);

  const updateConversation = (id, updater) => setConversations((current) => current.map((conversation) => conversation.id === id ? updater(conversation) : conversation));
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const newChat = () => { const conversation = makeConversation(); setConversations((current) => [conversation, ...current]); setActiveId(conversation.id); setInput(''); setSettingsOpen(false); setMobileOpen(false); textareaRef.current?.focus(); };
  const deleteConversation = async (id) => { const remaining = conversations.filter((conversation) => conversation.id !== id); if (!remaining.length) { const fresh = makeConversation(); setConversations([fresh]); setActiveId(fresh.id); } else { setConversations(remaining); if (activeId === id) setActiveId(remaining[0].id); } if (auth?.token) { const response = await fetch(`/api/conversations/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } }); if (!response.ok) showToast('Could not delete chat from database.'); } showToast('Conversation deleted'); };
  const renameConversation = async (conversation) => { const title = window.prompt('Conversation name', conversation.title); if (!title?.trim()) return; updateConversation(conversation.id, (current) => ({ ...current, title: title.trim() })); if (auth?.token) await fetch(`/api/conversations/${conversation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ title: title.trim() }) }); showToast('Conversation renamed'); };
  const pinConversation = async (conversation) => { const pinned = !conversation.pinned; updateConversation(conversation.id, (current) => ({ ...current, pinned })); if (auth?.token) await fetch(`/api/conversations/${conversation.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` }, body: JSON.stringify({ pinned }) }); showToast(pinned ? 'Conversation pinned' : 'Conversation unpinned'); };
  const clearChat = () => updateConversation(activeId, (conversation) => ({ ...conversation, messages: [], title: 'New conversation' }));

  const sendMessage = async (messageText = input, regenerate = false) => {
    const text = messageText.trim();
    if ((!text && !attachments.length) || isLoading) return;
    const requestText = text || 'Please analyze the attached file and describe the important details.';
    const priorMessages = regenerate ? messages.slice(0, -1) : messages;
    const userMessage = { id: uid(), role: 'user', content: requestText, createdAt: Date.now() };
    const nextMessages = regenerate ? [...priorMessages, userMessage] : [...messages, userMessage];
    updateConversation(activeId, (conversation) => ({ ...conversation, messages: nextMessages, title: conversation.messages.length ? conversation.title : text.slice(0, 34) }));
    setInput(''); setIsLoading(true);
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}) }, body: JSON.stringify({ messages: nextMessages, model: settings.model, mode, attachments, conversationId: activeId, conversationTitle: activeConversation?.messages.length ? activeConversation.title : requestText.slice(0, 34), pinned: activeConversation?.pinned }) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Unable to reach Gemini.'); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      const assistantId = uid();
      updateConversation(activeId, (conversation) => ({ ...conversation, messages: [...conversation.messages, { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() }] }));
      while (true) { const { value, done } = await reader.read(); if (done) break; assistantText += decoder.decode(value, { stream: true }); updateConversation(activeId, (conversation) => ({ ...conversation, messages: conversation.messages.map((message) => message.id === assistantId ? { ...message, content: assistantText } : message) })); }
      updateConversation(activeId, (conversation) => ({
        ...conversation,
        messages: conversation.messages.map((message) => message.id === assistantId ? { ...message, content: assistantText } : message)
      }));
      setAttachments([]);
    } catch (error) {
      updateConversation(activeId, (conversation) => ({ ...conversation, messages: [...conversation.messages, { id: uid(), role: 'assistant', isError: true, content: `**Something went wrong**\n\n${error.message}\n\nPlease check your connection and try again.`, createdAt: Date.now() }] }));
    } finally { setIsLoading(false); }
  };

  const handleKeyDown = (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } };
  const regenerate = () => { const lastUser = [...messages].reverse().find((message) => message.role === 'user'); if (lastUser) sendMessage(lastUser.content, true); };
  const handleFiles = (event) => { Array.from(event.target.files || []).slice(0, 3).forEach((file) => { const isText = file.type.startsWith('text/') || /\.(md|csv|json|xml|js|jsx|ts|tsx|css|html|sql)$/i.test(file.name); const reader = new FileReader(); reader.onload = () => { const result = String(reader.result); const data = result.startsWith('data:') ? result.split(',')[1] : btoa(unescape(encodeURIComponent(result))); setAttachments((current) => [...current, { name: file.name, mimeType: file.type || 'application/octet-stream', data, content: isText ? result : '', previewUrl: result.startsWith('data:image/') ? result : '' }]); }; if (isText) reader.readAsText(file); else reader.readAsDataURL(file); }); event.target.value = ''; };
  const startVoice = () => { const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Recognition) return; const recognition = new Recognition(); recognition.lang = mode === 'marathi' ? 'mr-IN' : 'en-US'; recognition.onstart = () => setRecording(true); recognition.onend = () => setRecording(false); recognition.onresult = (event) => setInput((current) => `${current}${current ? ' ' : ''}${event.results[0][0].transcript}`); recognition.start(); };
  const speak = (text) => { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, '')); utterance.lang = mode === 'marathi' ? 'mr-IN' : 'en-US'; utterance.rate = mode === 'marathi' ? .92 : 1; window.speechSynthesis.speak(utterance); };
  const handleAuth = async ({ email, password, registering, avatar }) => {
    setAuthError('');
    try {
      const response = await fetch(`/api/auth/${registering ? 'register' : 'login'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, avatar: registering ? avatar : undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAuthError(data.error || 'Unable to complete authentication.'); return; }
      setAuth(data); setForceLogin(false); setAuthOpen(false);
    } catch { setAuthError('Unable to reach the server. Check that the API and MySQL are running.'); }
  };
  const logout = () => {
    const fresh = makeConversation();
    setAuth(null);
    setConversations([fresh]);
    setActiveId(fresh.id);
    setForceLogin(true);
    setAuthOpen(false);
    setInput('');
  };
  const updateAuth = (data) => setAuth(data);

  if (forceLogin) return <AuthPanel onClose={() => {}} onAuth={handleAuth} authError={authError} forceRegister />;

  return <div className={`app-shell ${settings.compact ? 'compact' : ''}`}>
    <Sidebar conversations={conversations} activeId={activeId} onSelect={setActiveId} onNew={newChat} onDelete={deleteConversation} onRename={renameConversation} onPin={pinConversation} onSettings={() => setSettingsOpen(true)} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} auth={auth} onAuth={() => { setAuthError(''); setForceLogin(false); setAuthOpen(true); }} onLogout={logout} search={search} setSearch={setSearch} />
    {mobileOpen && <button className="sidebar-scrim" onClick={() => setMobileOpen(false)} aria-label="Close sidebar" />}
    <main className="main-content">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="mobile-title"><BrandLogo className="mobile-logo" /><strong>Adesh</strong></div><div className="topbar-title"><span className="status-dot" /> Adesh AI <span className="slash">/</span> <strong>{activeConversation?.title}</strong></div><div className="topbar-actions"><button className="clear-button" onClick={clearChat}><Trash2 size={15} /> Clear chat</button><button className="icon-button" onClick={() => setSettingsOpen(true)} title="Settings"><Settings size={18} /></button></div></header>
      {settingsOpen ? <><SettingsPanel settings={settings} setSettings={setSettings} onClose={() => setSettingsOpen(false)} />{auth && <ProfileSettings auth={auth} onAuthUpdate={updateAuth} showToast={showToast} />}</> : <>
        <section className="chat-area"><div className="chat-inner">
          {!messages.length && <div className="welcome"><BrandLogo className="welcome-logo" /><span className="eyebrow">Your thinking partner</span><h1>Hello! <span>👋</span><br />How can I help you today?</h1><p>Ask anything, explore an idea, or get a fresh perspective on your work.</p><div className="suggestions">{suggestions.map((suggestion, index) => <button key={suggestion.label} className={`suggestion-card suggestion-${index}`} onClick={() => { setInput(suggestion.text); textareaRef.current?.focus(); }}><span>{['✦', '</>', 'Aa', '≡'][index]}</span><strong>{suggestion.label}</strong><ArrowUp size={14} /></button>)}</div></div>}
          {!!messages.length && <div className="messages">{messages.map((message, index) => <Message key={message.id} message={message} isLast={index === messages.length - 1 && message.role === 'assistant'} onRegenerate={regenerate} onSpeak={speak} />)}{isLoading && <TypingIndicator />}<div ref={endRef} /></div>}
        </div></section>
        <div className="composer-wrap"><div className="composer-tools"><div className="mode-picker"><span>Adesh mode</span><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="general">General</option><option value="marathi">Marathi assistant</option><option value="coding">Coding assistant</option><option value="business">Business advisor</option></select><ChevronDown size={13} /></div></div><div className="composer"><textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleKeyDown} placeholder="Message Adesh..." rows="1" /><div className="composer-footer"><div className="composer-left"><input ref={fileInputRef} type="file" accept="*/*" multiple hidden onChange={handleFiles} /><button className="tool-button" onClick={() => fileInputRef.current?.click()} title="Attach any file"><Paperclip size={16} /> Attach</button><button className={`tool-button ${recording ? 'recording' : ''}`} onClick={startVoice} title="Use voice input"><Mic size={16} /> {recording ? 'Listening' : 'Voice'}</button><span className="keyboard-hint"><span className="shortcut">Shift</span> + <span className="shortcut">Enter</span></span></div><button className="send-button" onClick={() => sendMessage()} disabled={(!input.trim() && !attachments.length) || isLoading} title="Send message"><ArrowUp size={18} /></button></div>{attachments.length > 0 && <div className="attachment-list">{attachments.map((attachment) => <span key={attachment.name}><Paperclip size={12} /> {attachment.name}</span>)}</div>}</div><div className="disclaimer">Adesh can make mistakes. Check important information.</div></div>
      </>}
    </main>
    {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} onAuth={handleAuth} authError={authError} forceLogin={forceLogin} />}
    <nav className="mobile-nav"><button onClick={newChat}><Plus size={17} /><span>New</span></button><button onClick={() => setMobileOpen(true)}><Search size={17} /><span>Chats</span></button><button onClick={() => setSettingsOpen(true)}><Settings size={17} /><span>Settings</span></button><button onClick={auth ? logout : () => { setAuthError(''); setAuthOpen(true); }}><UserAvatar auth={auth} /><span>{auth ? 'Logout' : 'Login'}</span></button></nav>
    {toast && <div className="toast-message" role="status">{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
