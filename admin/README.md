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

## Admin Push Notifications

To enable browser push in the admin dashboard, add the same public Firebase web config used by the user frontend to `admin/frontend/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

The admin backend stores the browser push token on the MongoDB user identified by `ADMIN_PUSH_USER_EMAIL`. If that user does not exist yet, it creates a lightweight `role: admin` user for push delivery.

```env
ADMIN_PUSH_USER_EMAIL=admin-user@example.com
```
