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

### Team Members
1.  Betselot Tesfa (ETS0327/14)
2.	Edom Mulugeta	(ETS0503/14)
3.	Gelila Nebiyu (ETS0690/14)
4.	Meklit Habtamu (ETS1030/14)
5.	Rafia Kedir	(ETS1329/14)



