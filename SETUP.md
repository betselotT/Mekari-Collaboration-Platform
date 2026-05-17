# Mekari Collaboration Platform Setup Guide

## Introduction

This guide explains how to set up and run the Mekari Collaboration Platform locally for development purposes.

The project consists of:

- Frontend application
- Backend API service

Both services must run simultaneously for the platform to function correctly.

---

# Prerequisites

Before starting, ensure the following tools are installed on your system.

## Required Software

- Node.js (recommended version 18 or later)
- npm package manager
- Git

---

# Project Structure

The repository is divided into two main sections.

```text
frontend/   → Next.js frontend application
backend/    → Backend API service
```

---

# Repository Setup

Clone the repository locally.

```bash
git clone https://github.com/betselotT/Mekari-Collaboration-Platform.git
cd Mekari-Collaboration-Platform
```

---

# Backend Setup

Navigate to the backend directory.

```bash
cd backend
```
## Install Backend Dependencies


```bash
npm install
```

---

## Start Backend Development Server

Run the backend development server.

```bash
npm run dev
```

The backend server will run on:

```text
http://localhost:4000
```

---

# Frontend Setup

Open a new terminal and navigate to the frontend directory.

```bash
cd frontend
```

---

## Install Frontend Dependencies


```bash
npm install
```

---

## Start Frontend Development Server

Run the frontend development server.

```bash
npm run dev
```

The frontend application will run on:

```text
http://localhost:3000
```

The frontend expects the backend server to be available at:

```text
http://localhost:4000
```

---

# Running the Full Application

To run the complete platform locally:

1. Start the backend server
2. Start the frontend server
3. Open the frontend URL in the browser
4. Ensure API requests are successfully reaching the backend service

---

# Common Development Workflow

Typical workflow during development:

```text
1. Pull latest changes
2. Install dependencies if needed
3. Run backend server
4. Run frontend server
5. Test features locally
6. Commit and push changes
```

---

# Troubleshooting

## Port Already In Use

If port `3000` or `4000` is already occupied:

- Stop the conflicting application
- Or change the configured port value

---

## Missing Dependencies

If modules fail to install:

```bash
npm install
```

Run the installation command again.

---

## Environment Variable Issues

Ensure:

- `.env` file exists
- Required variables are configured correctly
- Backend server is restarted after changes

---

# Notes

- Both frontend and backend services must be running simultaneously.
- Ensure API endpoints match the configured backend URL.
- Use development environment variables only during local testing.

---

# Conclusion

The Mekari Collaboration Platform should now be successfully configured for local development and testing.
