# Mekari Admin

Separate admin workspace for mentor verification, reports, and activity review.

## Structure

- `backend` - Express API on port `4100`
- `frontend` - Next.js dashboard on port `3100`

## Run Locally

Install dependencies once in both folders:

```powershell
cd admin/backend
npm.cmd install

cd ../frontend
npm.cmd install
```

Start both apps:

```powershell
cd admin/backend
npm.cmd run dev
```

```powershell
cd admin/frontend
npm.cmd run dev
```

Open `http://localhost:3100`.

Seeded admin credential:

```text
Username: admin
Password: MekariAdmin2026!
```

The admin backend reads `admin/backend/.env` when present and falls back to the main `backend/.env` for `MONGO_URI`.
