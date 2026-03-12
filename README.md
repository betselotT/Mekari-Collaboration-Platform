## MEKARI: Collaboration Platform

This repository contains a production-ready implementation scaffold for the MEKARI senior research project, with a `backend` (Node.js/Express, MongoDB, Redis) and a `frontend` (Next.js, Tailwind CSS).

### Backend (`/backend`)

- Node.js + Express + TypeScript
- MongoDB via Mongoose
- Redis client for real-time messaging infrastructure
- JWT-based authentication
- Core domain models: users, threads, messages
- REST APIs under `/api/*` and Socket.IO for real-time chat

#### Backend setup

```bash
cd backend
cp .env.example .env   # and adjust values
npm install
npm run dev
```

The backend will run on `http://localhost:4000` by default.

### Frontend (`/frontend`)

- Next.js 14 (App Router) + React 18
- Tailwind CSS for styling
- Basic onboarding (login/register) and dashboard pages

#### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:3000` by default and expects the backend on `http://localhost:4000`.

### Next steps

The current implementation gives you a solid foundation aligned with the capstone design: authentication, user profiles, threads/messages, gamification and analytics endpoints, plus a modern UI shell. You can now continue iterating to add Google Meet integration, richer AI chatbot behavior, advanced matching logic and any additional requirements from your project document.

