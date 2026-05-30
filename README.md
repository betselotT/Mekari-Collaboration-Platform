# MEKARI Collaboration Platform

MEKARI is a full-stack, real-time collaboration platform designed to help students, developers, engineers, and technical professionals connect with peers and domain experts for faster academic and technical support.

The platform combines discussion threads, real-time messaging, AI-assisted problem understanding, expert matching, gamification, notifications, and an admin workspace into one integrated collaboration environment.

## Project Overview

Modern learners often rely on separate tools such as messaging apps, forums, video meetings, AI assistants, and learning platforms. MEKARI reduces this fragmentation by providing a single collaboration space where users can ask questions, receive AI-supported guidance, connect with experts, and preserve solved problems as reusable knowledge.

This project was developed as an academic capstone project using agile development practices, user-centered design, and full-stack software engineering principles.

## Key Features

- User registration and login
- Google and GitHub authentication support
- Thread-based technical discussions
- Real-time chat using Socket.IO
- Direct messaging between users
- AI-assisted question analysis
- Intelligent expert matching
- Similar problem retrieval
- Tag recommendation
- Knowledge capture from solved issues
- Gamification through points and leaderboards
- Push notification support
- Report and moderation workflow
- Admin dashboard for platform monitoring and management

## Technology Stack

### Frontend

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- React Query
- Socket.IO Client
- Firebase Cloud Messaging support

### Backend

- Node.js
- Express.js
- TypeScript
- MongoDB with Mongoose
- Socket.IO
- JWT authentication
- Redis support for real-time infrastructure

### Intelligence Service

- Python
- FastAPI
- MongoDB async integration
- Gemini API integration support

### Admin Module

- Separate admin frontend built with Next.js
- Separate admin backend built with Express.js
- Admin authentication
- User, report, notification, and activity management

## Project Structure

```text
Mekari-Collaboration-Platform/
|-- backend/              # Main Express API, sockets, models, services, and intelligence bridge
|-- frontend/             # User-facing Next.js application
|-- admin/
|   |-- backend/          # Admin API service
|   `-- frontend/         # Admin dashboard
|-- docs/                 # Academic project documentation
|-- SETUP.md              # Detailed setup guide
|-- CONTRIBUTING.md       # Contribution guidelines
`-- README.md
```

## Getting Started

For complete installation and setup instructions, see:

```text
SETUP.md
```

### Basic Local Development

Install and run the main backend:

```bash
cd backend
npm install
npm run dev
```

The backend runs on:

```text
http://localhost:4000
```

Install and run the main frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on:

```text
http://localhost:3000
```

Run the admin backend:

```bash
cd admin/backend
npm install
npm run dev
```

The admin backend runs on:

```text
http://localhost:4100
```

Run the admin frontend:

```bash
cd admin/frontend
npm install
npm run dev
```

The admin dashboard runs on:

```text
http://localhost:3100
```

## Environment Configuration

The project uses environment variables for database connections, authentication, external APIs, Firebase notifications, OAuth providers, and admin access.

Common backend variables include:

```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/mekari
JWT_SECRET=your_jwt_secret
REDIS_URL=redis://localhost:6379
FRONTEND_ORIGIN=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
```

Common frontend variables include:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
```

Backend reCAPTCHA variable:

```env
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

Admin-related variables include:

```env
ADMIN_PORT=4100
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_admin_password
ADMIN_SESSION_TOKEN=your_admin_session_token
ADMIN_API_KEY=your_admin_api_key
ADMIN_FRONTEND_ORIGIN=http://localhost:3100
```


## Academic Context

MEKARI was developed as a university capstone project. The project reflects academic research, system design, software implementation, testing, and documentation completed under university supervision and advisor guidance.

## Team Members

1. Betselot Tesfa - ETS0327/14
2. Edom Mulugeta - ETS0503/14
3. Gelila Nebiyu - ETS0690/14
4. Meklit Habtamu - ETS1030/14
5. Rafia Kedir - ETS1329/14

## Documentation

The full senior research project document is available in the `docs/` directory.

## Contributing

This repository may be used by future student teams or authorized contributors for academic continuation, review, or improvement.

Recommended contribution workflow:

```bash
git checkout -b feature/your-feature-name
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
```

Then open a pull request for review.

See `CONTRIBUTING.md` for more details.

## License and Ownership

This project was developed as part of a university-assigned academic capstone project under advisor supervision. Because the university assigns the advisor, supervises the project, and follows the work through completion, the project is considered academic and institutional work associated with the university.

All ownership, usage, distribution, and modification rights are subject to the policies and approval of the university, the supervising department, and the project advisors.

Unless explicit permission is granted by the university or authorized representatives, this project should not be treated as open-source software or redistributed under a public software license.

Copyright (c) 2026 MEKARI Capstone Project Team and the supervising university. All rights reserved.
