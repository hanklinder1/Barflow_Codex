# BarFlow

BarFlow is a mobile-first nightlife coordination app for college students in a single downtown district (seeded for Clemson).

## Features

- Secure email/password auth with JWT sessions
- First-login onboarding profile creation
- Static predefined bar catalog with metadata and vibe tags
- Manual and automatic check-ins (geofence + nearest-bar detection)
- Real-time check-in visibility for friends
- Friend requests and mutual friendships
- 1:1 friend-only direct messaging with unread counts
- Real-time nudges with anti-spam rate limiting
- Map view with bars and friends currently checked in
- Profile settings and logout

## Tech Stack

- Backend: Node.js, Express, TypeScript, Prisma, SQLite, Socket.IO
- Frontend: React, TypeScript, Vite, React Router, React Leaflet, Socket.IO client

## Project Structure

- `backend/` API server, data model, real-time events
- `frontend/` web client

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Generate Prisma client + migrate + seed bars:

```bash
npm run prisma:generate --workspace backend
npm run prisma:migrate --workspace backend -- --name init
npm run prisma:seed --workspace backend
```

4. Start both apps:

```bash
npm run dev
```

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:5173`

## Security & Access Rules

- Unauthenticated access is blocked for app content endpoints.
- Only accepted friends can view check-ins, message, and nudge each other.
- Users can only have one active check-in at a time.
- Nudge sending is rate-limited (5/minute per sender).

## Key API Endpoints

- Auth: `POST /auth/signup`, `POST /auth/signin`, `GET /auth/me`
- Profile: `POST /profiles`, `PATCH /profiles/me`
- Bars: `GET /bars`
- Friends: `GET /friends`, `GET /friends/search`, request/response endpoints
- Check-ins: `POST /checkins/manual`, `POST /checkins/auto`, `POST /checkins/checkout`
- Map: `GET /map/overview`
- Messages: conversation list, thread fetch, send message
- Nudges: list, send, dismiss

## Realtime Events

- `checkin:update`
- `message:new`
- `nudge:new`
- `friend:request`
- `friend:accepted`
