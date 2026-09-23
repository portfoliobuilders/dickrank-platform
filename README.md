# DickRank

DickRank is an adults-only site. People create an account, confirm their email, and send a government ID. A reviewer has to approve that ID before member areas open. Uploading an ID does not unlock the site by itself.

## What you need

- Node.js 18 or newer
- A PostgreSQL database (Supabase works)
- A long random secret for sign-in cookies

## Set up

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

- `DATABASE_URL` — the Postgres connection string
- `PII_ENCRYPTION_KEY` — 32 random bytes, base64 (`openssl rand -base64 32`)
- `PII_HASH_PEPPER` and `NEXTAUTH_SECRET` — long random strings
- `NEXTAUTH_URL` — `http://localhost:3000` on your machine

Then create the tables and start the site:

```bash
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000.

In local development, the sign-up screen shows the email code, and the forgot-password screen shows a reset link. Those shortcuts are not included in a production build.

## Sign-in flow

1. **Account** — email, username, and password. The password is stored as a bcrypt hash. The email is encrypted.
2. **Email** — 6-digit code.
3. **Age** — front and back of a government ID, plus a live camera selfie. Files are encrypted, then a row is added to the review queue with status `PENDING`.

Member pages (`/dashboard`, `/upload`, `/creator`) stay closed until `ageVerification` is true. Public pages are `/`, `/login`, `/register`, and `/explore`.

## Manual test

1. Open `/register` and create an account. Confirm the email code.
2. On the age step, try to continue without photos and confirm the form stops you.
3. Open `/login` and use a wrong password. You should see an error, not a blank page.
4. Use “Forgot password” and confirm the page does not reveal whether the email exists.
5. While signed in but not approved, open `/dashboard`. You should land on `/verify-age`.
6. Open `/explore` while signed out. “Open adult rankings” should send you to register. Signed in and not approved, it should show “Verify your age to continue.”

Reload the site after pulling changes.
