# Adesh AI

A responsive Gemini-powered chat workspace with streaming responses, file context, voice controls, assistant modes, exports, local history, optional login, and secure server-side API access.

## Requirements

- Node.js 18+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` in the project root and add:

   ```env
   GEMINI_API_KEY=your_api_key_here
   PORT=3001
   JWT_SECRET=replace_with_a_long_random_secret
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=adesh
   ```

3. Start the development app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173`.

The browser calls `/api/chat`; the Gemini key is read only by `server/index.js` and is never bundled into client-side JavaScript.

## Features

- Token-by-token Gemini streaming
- PDF, image, Markdown, and text attachments as Gemini context
- General, Marathi, coding, and business assistant modes
- Microphone input and read-aloud responses where browser speech APIs are available
- TXT, Markdown, and print-to-PDF conversation export
- Local history in the browser; sign-in and MySQL-backed history when the `DB_*` settings are configured

The server creates the `adesh` database and its `users` and `chats` tables automatically. MySQL must be running and the configured user must have permission to create databases. For production, set a strong `JWT_SECRET`.

## Production build

```bash
npm run build
npm start
```

`npm run build` creates the Vite client bundle in `dist`. For a production deployment, serve the built client with your preferred static host and run the API server with the same `GEMINI_API_KEY` environment variable. Add a reverse proxy from `/api` to port `3001`.
"# ChatBot" 
"# adeshchatbot" 
