# Digital Wallet / Banking System (No Docker)

Full-stack demo app:

- **Backend**: Express + MongoDB + JWT in **httpOnly cookie**
- **Frontend**: React (Vite) + TypeScript + Tailwind UI
- **Roles**: `user` and `admin`
- **Transactions**: deposit, withdrawal, transfer (with optional admin approval simulation)

## Requirements

- Node.js 18+ (recommended)
- MongoDB running locally (or a MongoDB URI)

## Project structure

- `server/` Express API
- `client/` React app

## Backend setup

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### Backend env vars

Edit `server/.env`:

- **MONGO_URI**: e.g. `mongodb://127.0.0.1:27017/digital_wallet`
- **JWT_SECRET**: set a long random string
- **CLIENT_ORIGIN**: `http://localhost:5173` (Vite dev server)
- **APPROVAL_THRESHOLD**: transfers >= this amount become `pending` until an admin approves

API will run at `http://localhost:4000`.

## Frontend setup

```bash
cd client
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Auth model (cookie-based)

- Backend sets a JWT in an **httpOnly cookie** named `wallet_token` by default.
- Frontend calls API with `credentials: "include"` so cookies are sent automatically.

## Admin usage

Admins can:

- View all users + balances
- Freeze/unfreeze accounts
- View all transactions
- Approve/reject **pending transfers**

### Create an admin user (quick way)

Register a normal user via the UI, then in MongoDB set:

- `users.role = "admin"`

Example (Mongo shell):

```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "admin" } })
```

## API routes

### `/api/auth`

- `POST /register`
- `POST /login`
- `POST /logout`
- `GET /me`
- `PUT /me` (update profile: name/email/password)

### `/api/users` (admin)

- `GET /` (list users)
- `POST /` (create user)
- `PATCH /:id` (freeze/unfreeze, set role)
- `DELETE /:id`

### `/api/transactions`

- `POST /` (create deposit/withdrawal/transfer)
- `GET /` (current user history)
- `GET /all` (admin: list all)
- `PATCH /:id` (admin: approve/reject pending transfer)

## Notes

- This is a **simulation** (no real banking rails).
- Money movements use MongoDB transactions (session) to keep balances consistent.