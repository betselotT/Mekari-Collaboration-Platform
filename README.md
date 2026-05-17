## MEKARI: Collaboration Platform

Project Overview
Mekari is a lightweight, full-stack, real-time collaboration platform designed to connect students, developers, engineers, and technical professionals across disciplines with domain experts for instant peer support.
It solves the fragmentation problem of existing tools (Stack Overflow, Discord, Teams, ChatGPT, etc.) by combining:

- Real-time voice + interactive whiteboard sessions
- AI-powered context-aware chatbot with human escalation
- Intelligent subject-based expert matching & availability indicators
- Threaded chat with attachments and notifications
- Gamification (points, badges, leaderboards)
- Evolving knowledge repository from solved issues

Mekari was developed as a Capstone Project for Student Collaboration following agile (Scrum) methodology, user-centered design, and industry best practices.
### Backend (`/backend`)

- Node.js + Express + TypeScript
- MongoDB via Mongoose
- Redis client for real-time messaging infrastructure
- JWT-based authentication
- Core domain models: users, threads, messages, intelligence (FeedbackEvent, KnowledgeDoc, PointEvent, Report, Notification)
- REST APIs under `/api/*` and Socket.IO for real-time chat
- Intelligence Module (AI Pipeline, Knowledge Capture, Points System)
- Docker support via `docker-compose.yml` for easy deployment


### Frontend (`/frontend`)

- Next.js 14 (App Router) + React 18
- Tailwind CSS for styling
- Basic onboarding (login/register) and dashboard pages
- Core modules: auth hooks, socket context, responsive dynamic dashboard and thread views


#### Contributing (For Future Student Teams / Open Source)

- Fork the repository
- Create a feature branch (git checkout -b feature/amazing-feature)
- Commit using Conventional Commits
- Push and open a Pull Request

See CONTRIBUTING.md (to be added) for detailed guidelines.

#### Documentation

- Full Senior Research Project Document (DOCX/PDF) in /docs

#### License
This project is developed as part of an academic capstone.

### Team Members
1.  Betselot Tesfa (ETS0327/14)
2.	Edom Mulugeta	(ETS0503/14)
3.	Gelila Nebiyu (ETS0690/14)
4.	Meklit Habtamu (ETS1030/14)
5.	Rafia Kedir	(ETS1329/14)



