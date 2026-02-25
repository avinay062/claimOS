# ClaimsOS — Complete Setup Guide (Phase 1 + 2)

## Prerequisites

| Tool | Min Version | Install |
|------|-------------|---------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Comes with Node |
| MongoDB Atlas account | — | https://cloud.mongodb.com (free tier works) |
| Redis | 7+ | See options below |

---

## Step 1 — Clone / Download

Unzip the project. You should see:
```
claimsOS/
  backend/
  frontend/
  SETUP.md
  README.md
```

---

## Step 2 — MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com → Create a free cluster
2. Create a database user (username + password)
3. Whitelist your IP (or use 0.0.0.0/0 for development)
4. Click "Connect" → "Connect your application"
5. Copy the connection string — looks like:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/claimsOS?retryWrites=true&w=majority
   ```

---

## Step 3 — Redis Setup (pick one)

### Option A: Docker (easiest)
```bash
docker run -d --name claimsOS-redis -p 6379:6379 redis:7-alpine
```

### Option B: macOS
```bash
brew install redis && brew services start redis
```

### Option C: Ubuntu / Debian
```bash
sudo apt install redis-server && sudo systemctl start redis
```

### Option D: Windows
Download Redis from https://github.com/microsoftarchive/redis/releases  
Or use WSL2 with Ubuntu Option B.

---

## Step 4 — Backend Setup

```bash
# 1. Enter backend directory
cd claimsOS/backend

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env
```

### Edit `.env` with your values:

```env
PORT=5000
NODE_ENV=development

# ── Required ──────────────────────────────────────────────
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/claimsOS?retryWrites=true&w=majority
JWT_SECRET=change-this-to-a-long-random-string-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=another-different-long-random-string-min-32-chars
JWT_REFRESH_EXPIRES_IN=30d
FRONTEND_URL=http://localhost:3000

# ── Optional (Phase 2 features) ──────────────────────────
# Leave these empty to run in dev mode (mock uploads + mock emails)

REDIS_URL=redis://localhost:6379        # Uses local Redis above

# AWS S3 (for real file uploads — leave blank to use memory mode)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=claimsOS-documents

# Resend (for real emails — leave blank to log emails to console)
RESEND_API_KEY=
EMAIL_FROM=ClaimsOS <notifications@yourdomain.com>
APP_URL=http://localhost:3000
```

> **Dev tip:** You can leave `AWS_*` and `RESEND_API_KEY` empty.  
> File uploads will store to memory and email sends will print to console — perfect for local dev.

```bash
# 5. Start the backend
npm run dev
```

You should see:
```
✅ MongoDB connected: cluster0.xxxxx.mongodb.net
✅ Overdue task cron scheduled (hourly)
✅ Due-soon reminder cron scheduled (daily 8am)
✅ Reassessment alert cron scheduled (daily 9am)
🚀 ClaimsOS API running on port 5000 [development]
```

**Health check:** Open http://localhost:5000/health — should return `{"status":"ok"}`

---

## Step 5 — Frontend Setup

Open a **new terminal tab/window**.

```bash
# 1. Enter frontend directory
cd claimsOS/frontend

# 2. Install dependencies
npm install

# 3. Create .env.local
cp .env.local.example .env.local

# (The default value http://localhost:5000/api is correct — no changes needed)

# 4. Start the frontend
npm run dev
```

You should see:
```
▲ Next.js 14.2.3
- Local: http://localhost:3000
```

---

## Step 6 — Create Your First Admin Account

Open http://localhost:3000/auth/register

Register with any email/password. Then, in MongoDB Atlas:

1. Go to your cluster → Collections → `claimsOS.users`
2. Find your user document
3. Edit the `role` field from `"read_only"` to `"admin"`
4. Save

Alternatively, use the MongoDB shell or Atlas Data Explorer to run:
```js
db.users.updateOne(
  { email: "your@email.com" },
  { $set: { role: "admin" } }
)
```

Now log in — you'll have full admin access.

---

## All Commands Summary

```bash
# Terminal 1 — Backend
cd claimsOS/backend
npm install
cp .env.example .env   # then edit with your MongoDB URI + JWT secrets
npm run dev            # runs on http://localhost:5000

# Terminal 2 — Frontend
cd claimsOS/frontend
npm install
cp .env.local.example .env.local
npm run dev            # runs on http://localhost:3000

# Terminal 3 — Redis (if using Docker)
docker run -d --name claimsOS-redis -p 6379:6379 redis:7-alpine
```

---

## Project Structure

```
claimsOS/
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js              ← Express app entry
│       ├── config/
│       │   ├── db.js             ← MongoDB connection
│       │   ├── redis.js          ← Redis/BullMQ config
│       │   └── s3.js             ← AWS S3 client
│       ├── middleware/
│       │   ├── auth.js           ← JWT protect + RBAC
│       │   ├── errorHandler.js   ← Global error handler
│       │   └── upload.js         ← Multer S3 file upload
│       ├── models/
│       │   ├── User.js           ← 5 roles, RBAC permissions
│       │   ├── Statement.js      ← Statement library
│       │   ├── Claim.js          ← State machine, e-sigs
│       │   ├── Product.js        ← Product catalogue
│       │   ├── AuditLog.js       ← Immutable audit trail
│       │   ├── Substantiation.js ← Evidence documents
│       │   ├── ClaimSubstantiation.js ← Many-to-many join
│       │   ├── WorkflowTask.js   ← Task assignments
│       │   └── Notification.js   ← In-app notifications
│       ├── routes/
│       │   ├── auth.js           ← register/login/refresh/logout/me
│       │   ├── users.js          ← Admin user management
│       │   ├── statements.js     ← Statement CRUD + lifecycle
│       │   ├── claims.js         ← Claim CRUD + state machine
│       │   ├── products.js       ← Product CRUD
│       │   ├── dashboard.js      ← Aggregated stats
│       │   ├── audit.js          ← Audit log queries
│       │   ├── substantiations.js← Evidence docs + S3 + bulk link
│       │   ├── tasks.js          ← Workflow task management
│       │   └── notifications.js  ← In-app notification feed
│       ├── services/
│       │   ├── tokenService.js   ← JWT generation/verification
│       │   ├── auditService.js   ← Audit log writer
│       │   ├── emailService.js   ← Resend email templates
│       │   ├── notificationService.js ← In-app notify
│       │   └── workflowTaskService.js ← Task create + notify
│       └── workers/
│           └── cronJobs.js       ← Scheduled background jobs
│
└── frontend/
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── postcss.config.js
    ├── app/
    │   ├── layout.tsx            ← QueryClientProvider root
    │   ├── page.tsx              ← Redirects to /dashboard
    │   ├── globals.css           ← Tailwind + component classes
    │   ├── auth/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   ├── dashboard/page.tsx    ← Pipeline overview
    │   ├── statements/page.tsx   ← Statement library
    │   ├── claims/
    │   │   ├── page.tsx          ← Claims list
    │   │   └── [id]/page.tsx     ← Claim detail + lifecycle
    │   ├── products/page.tsx     ← Product catalogue
    │   ├── substantiations/
    │   │   ├── page.tsx          ← Substantiations list + upload
    │   │   └── [id]/page.tsx     ← Detail + link claims + bulk link
    │   └── tasks/page.tsx        ← My Tasks + complete
    ├── components/
    │   └── layout/AppLayout.tsx  ← Sidebar + notification bell
    └── lib/
        ├── api.ts                ← Axios client + auto token refresh
        └── authStore.ts          ← Zustand auth state
```

---

## API Endpoints Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Login → tokens |
| POST | /api/auth/refresh | Refresh access token |
| POST | /api/auth/logout | Invalidate tokens |
| GET  | /api/auth/me | Current user |

### Statements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/statements | List with search/filter |
| GET | /api/statements/:id | Detail |
| POST | /api/statements | Create |
| PUT | /api/statements/:id | Update |
| POST | /api/statements/:id/transition | Lifecycle status change |
| POST | /api/statements/:id/translations | Add/update translation |
| DELETE | /api/statements/:id | Delete |

### Claims
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/claims | List with filters |
| GET | /api/claims/:id | Detail with e-sigs + history |
| POST | /api/claims | Create |
| POST | /api/claims/:id/transition | State machine transition |
| POST | /api/claims/:id/copy | Copy to another product |
| DELETE | /api/claims/:id | Delete |

### Substantiations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/substantiations | List |
| GET | /api/substantiations/:id | Detail + linked claims |
| POST | /api/substantiations | Create |
| PUT | /api/substantiations/:id | Update |
| POST | /api/substantiations/:id/upload | Upload document to S3 |
| GET | /api/substantiations/:id/download-url | Presigned S3 URL |
| POST | /api/substantiations/:id/transition | Lifecycle |
| POST | /api/substantiations/:id/link-claims | Link to claims |
| DELETE | /api/substantiations/:id/unlink-claim/:claimId | Unlink |
| GET | /api/substantiations/by-claim/:claimId | All subs for a claim |
| POST | /api/substantiations/bulk-link | Bulk link up to 1,000 claims |
| DELETE | /api/substantiations/:id | Delete |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tasks | List (my tasks or all for admin) |
| GET | /api/tasks/my-summary | Badge counts |
| GET | /api/tasks/:id | Task detail |
| POST | /api/tasks | Create + notify assignee |
| PUT | /api/tasks/:id/start | Mark in-progress |
| PUT | /api/tasks/:id/complete | Complete with note |
| PUT | /api/tasks/:id/reassign | Reassign |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | Feed |
| GET | /api/notifications/unread-count | Badge count |
| PUT | /api/notifications/read-all | Mark all read |
| PUT | /api/notifications/:id/read | Mark one read |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | Aggregated stats |
| GET | /api/audit | Audit logs (admin/approver) |
| GET | /api/products | Products list |
| POST | /api/products | Create product |
| GET | /api/users | Users list (admin) |
| PUT | /api/users/:id/role | Change role (admin) |

---

## RBAC Roles

| Role | Statements | Claims | Substantiations | Tasks |
|------|-----------|--------|-----------------|-------|
| admin | Full | Full | Full | Full |
| brand_manager | Read + Write | Read + Write | Read + Write | Create + Complete own |
| legal_reviewer | Read | Read + Review | Read | Complete own |
| regulatory_approver | Read + Approve | Read + Approve | Read + Approve | Complete own |
| read_only | Read | Read | Read | None |

---

## Troubleshooting

**"Cannot connect to MongoDB"**  
→ Check your `MONGODB_URI` in `.env`. Make sure your IP is whitelisted in Atlas.

**"Redis connection error"**  
→ The app still works without Redis — cron jobs just won't run. Start Redis with Docker if you want them.

**"Token expired / 401"**  
→ The frontend auto-refreshes tokens. If you see repeated 401s, clear localStorage and log in again.

**Port already in use**  
→ Change `PORT=5001` in backend `.env` and `NEXT_PUBLIC_API_URL=http://localhost:5001/api` in frontend `.env.local`.

**"No statements with In Use status" when creating a claim**  
→ Create a Statement first, then transition it to "In Review" then "In Use" via the statement detail page.
