# Contributing to MEKARI

**MEKARI: A Real-Time Technical Collaboration Platform**  
**A Capstone Project for Collaboration of Students**  
**Addis Ababa Science and Technology University**

Thank you for considering contributing to **Mekari**! 

This project is developed by a team of Software Engineering students as their senior capstone project. We welcome contributions from fellow students, instructors, and open-source enthusiasts to help improve the platform.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Git Commit Guidelines](#git-commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Questions?](#questions)

---

## Code of Conduct

By participating in this project, you agree to abide by our `CODE_OF_CONDUCT.md` (if available) and to foster a **respectful, inclusive, and collaborative** environment.

---

## Getting Started

### 1. Prerequisites

- Node.js 20 LTS
- pnpm (recommended) or npm
- Docker & Docker Compose (recommended)
- Git

### 2. Fork & Clone the Repository

```bash
git clone https://github.com/your-username/mekari.git
cd mekari
```

### 3. Install Dependencies

```bash
# Backend
cd backend
pnpm install

# Frontend
cd ../frontend
pnpm install
```

### 4. Set up Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 5. Run the Project

```bash
# Using Docker (Recommended)
docker-compose up --build

# Or manually

# Terminal 1
cd backend && pnpm run dev

# Terminal 2
cd frontend && pnpm run dev
```

---

## Development Workflow

1. Create a new branch from `develop`:

```bash
git checkout develop
git checkout -b feature/your-feature-name

# or
git checkout -b bugfix/issue-description
```

2. Make your changes following the coding standards.
3. Test your changes (unit + manual testing).
4. Commit using Conventional Commits.
5. Push your branch and open a Pull Request.

---

## Coding Standards

- **Language:** TypeScript (strict mode enabled)
- **Frontend:** Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **Backend:** Node.js + Express + TypeScript
- Use ESLint + Prettier (enforced via Husky)
- Use meaningful variable and function names
- Write comments for complex logic
- Keep components small and focused

### Formatting

```bash
pnpm lint
pnpm format
```

---

## Git Commit Guidelines

We use **Conventional Commits**:

| Type        | Description |
|-------------|-------------|
| `feat:`     | New feature |
| `fix:`      | Bug fix |
| `docs:`     | Documentation changes |
| `style:`    | Formatting, missing semicolons, etc. |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `test:`     | Adding or correcting tests |
| `chore:`    | Maintenance (build, CI, etc.) |

### Examples

```bash
feat: implement expert matching algorithm
fix: resolve socket disconnection on mobile
docs: update README with production deployment guide
```

---

## Pull Request Process

Before submitting a PR:

- Ensure your branch is up to date with `develop`
- Make sure all tests pass
- Update documentation if needed
- Fill out the Pull Request template completely
- Request review from at least one team member:

  - Betselot Tesfa
  - Edom Mulugeta
  - Gelila Nebiyu
  - Meklit Habtamu
  - Rafia Kedir

### A good PR should:

- Have a clear title and description
- Reference any related issues
- Include screenshots (for UI changes)
- Be focused on one feature/fix

---

## Testing

```bash
# Backend tests
cd backend && pnpm test

# Frontend tests
cd frontend && pnpm test

# Lint check
pnpm lint
```

We highly encourage writing tests for new features.

---

## Reporting Bugs

Please open an issue using the **Bug Report** template and include:

- Steps to reproduce
- Expected vs Actual behavior
- Screenshots (if applicable)
- Environment (browser, OS, etc.)

---

## Suggesting Features

We welcome feature suggestions! Please open an issue with the **Feature Request** template explaining:

- The problem you're trying to solve
- Why it's important for users
- Any proposed solution

---

## Questions?

Feel free to:

- Open a Discussion in GitHub
- Contact any team member via email or university channels


---

# Thank You!

Your contributions help make Mekari a better platform for technical students and professionals across Ethiopia and beyond.

**Together we build better collaboration tools.**
