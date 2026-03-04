# ClaimsOS — Complete Setup Guide (All Phases 1–5)

## What's Included

| Phase | Features |
|-------|----------|
| 1 | Auth, RBAC, Statements, Claims, Products, Audit Log, Dashboard |
| 2 | Substantiation + S3 uploads, Workflow Tasks, Email Notifications, E-signatures |
| 3 | Local Adaptations, Location Config, Project Management, Global Search, Risk Analysis |
| 4 | Pack Copy — global masters, local copies, element management, localization completeness |
| 5 | Advanced Analytics, CSV export, Risk dashboard, User activity reporting |

---

## Prerequisites

| Tool | Min Version |
|------|-------------|
| Node.js | 18+ |
| npm | 9+ |
| MongoDB Atlas | Free tier works |
| Redis | 7+ (optional — for cron job queuing) |

---

## Quick Start

### 1. Backend

```bash
cd claimsOS/backend
npm install
cp .env.example .env
# → Edit .env with your MongoDB URI and JWT secrets
npm run dev
# API: http://localhost:5000
```

### 2. Frontend

```bash
cd claimsOS/frontend
npm install
cp .env.local.example .env.local
npm run dev
# App: http://localhost:3000
```

### 3. First Admin Account

1. Register at http://localhost:3000/auth/register
2. In MongoDB Atlas → Collections → users → find your user
3. Change `role` from `read_only` to `admin`
4. Log in — you'll have full admin access including the Admin Panel at `/admin`

### 4. Seed Risk Words (Recommended)

After logging in as admin, visit `/admin` → Risk Words tab → click **Seed Defaults** to populate industry-standard high-risk words.

---

## Project Structure

```
claimsOS/
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── index.js                  ← Express entry (v5.0 — all phases)
│       ├── config/
│       │   ├── db.js                 ← MongoDB connection
│       │   ├── redis.js              ← Redis/BullMQ (optional)
│       │   └── s3.js                 ← AWS S3 client (optional)
│       ├── middleware/
│       │   ├── auth.js               ← JWT protect + RBAC
│       │   ├── errorHandler.js
│       │   └── upload.js             ← Multer file upload
│       ├── models/
│       │   ├── User.js               ← 5 roles, RBAC
│       │   ├── Statement.js          ← Statement library
│       │   ├── Claim.js              ← [P3] + riskLevel, flaggedWords, projectId
│       │   ├── Product.js
│       │   ├── AuditLog.js
│       │   ├── Substantiation.js
│       │   ├── ClaimSubstantiation.js
│       │   ├── WorkflowTask.js
│       │   ├── Notification.js
│       │   ├── Location.js           ← [P3] Country/locale config
│       │   ├── LocalAdaptation.js    ← [P3] Country-level claim variants
│       │   ├── Project.js            ← [P3] Initiative grouping
│       │   ├── PackCopy.js           ← [P4] Packaging label content
│       │   └── RiskConfig.js         ← [P5] Configurable risk words
│       ├── routes/
│       │   ├── auth.js, users.js, statements.js, claims.js
│       │   ├── products.js, dashboard.js, audit.js
│       │   ├── substantiations.js, tasks.js, notifications.js
│       │   ├── locations.js          ← [P3]
│       │   ├── localAdaptations.js   ← [P3]
│       │   ├── projects.js           ← [P3]
│       │   ├── search.js             ← [P3] Global full-text search
│       │   ├── risk.js               ← [P3/P5] Risk word management
│       │   ├── packCopy.js           ← [P4] Full pack copy CRUD
│       │   └── analytics.js          ← [P5] KPIs, charts, CSV export
│       ├── services/
│       │   ├── tokenService.js, auditService.js, emailService.js
│       │   ├── notificationService.js, workflowTaskService.js
│       │   ├── riskService.js        ← [P3] Text risk analysis
│       │   └── searchService.js      ← [P3] Cross-entity search
│       └── workers/
│           └── cronJobs.js           ← [P5] All scheduled jobs
│
└── frontend/
    ├── package.json
    ├── next.config.js, tailwind.config.js, tsconfig.json
    ├── lib/
    │   ├── api.ts                    ← Axios + auto token refresh
    │   └── authStore.ts              ← Zustand auth state
    ├── components/layout/
    │   └── AppLayout.tsx             ← [P5] Full sidebar with all phases
    └── app/
        ├── layout.tsx, page.tsx, globals.css
        ├── auth/login/page.tsx
        ├── auth/register/page.tsx
        ├── dashboard/page.tsx        ← [P5] Risk alerts + all metrics
        ├── statements/page.tsx
        ├── claims/page.tsx + [id]/page.tsx
        ├── products/page.tsx
        ├── substantiations/page.tsx + [id]/page.tsx
        ├── tasks/page.tsx
        ├── local-adaptations/page.tsx + [id]/page.tsx   ← [P3]
        ├── projects/page.tsx + [id]/page.tsx             ← [P3]
        ├── search/page.tsx                               ← [P3]
        ├── pack-copy/page.tsx + [id]/page.tsx            ← [P4]
        ├── analytics/page.tsx                            ← [P5]
        └── admin/page.tsx                                ← [P5]
```

---

## API Reference — New Endpoints (Phases 3–5)

### Phase 3 — Localization & Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/locations | List all countries/locales |
| GET | /api/local-adaptations | List adaptations (filter: claimId, locationCode, status) |
| POST | /api/local-adaptations | Create local adaptation |
| POST | /api/local-adaptations/:id/transition | Lifecycle transition |
| GET | /api/projects | List projects |
| POST | /api/projects | Create project |
| POST | /api/projects/:id/claims | Add claims to project |
| GET | /api/search?q=term | Global search across all entities |
| POST | /api/risk/analyse | Analyse text for risk words |

### Phase 4 — Pack Copy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/pack-copy | List pack copies |
| POST | /api/pack-copy | Create global or local pack copy |
| POST | /api/pack-copy/:id/generate-local | Generate local copy from master |
| POST | /api/pack-copy/:id/elements | Add element to pack copy |
| DELETE | /api/pack-copy/:id/elements/:elId | Remove element |
| PUT | /api/pack-copy/:id/elements/:elId/translation | Add locale translation |
| POST | /api/pack-copy/:id/check-completeness | Check localization completeness |
| POST | /api/pack-copy/:id/transition | Lifecycle transition |
| GET | /api/pack-copy/:id/local-copies | List local copies of a master |

### Phase 5 — Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/analytics/overview | KPIs, totals, approval rate |
| GET | /api/analytics/claims-over-time | Monthly claim creation trends |
| GET | /api/analytics/risk | Risk distribution + high-risk claims |
| GET | /api/analytics/localization | Country coverage heatmap data |
| GET | /api/analytics/tasks | Task performance metrics |
| GET | /api/analytics/users | Per-user activity (admin only) |
| GET | /api/analytics/export | CSV export of all claims |
| GET | /api/risk | List risk words (admin) |
| POST | /api/risk | Add risk word |
| POST | /api/risk/seed-defaults | Seed industry defaults |

---

## Risk System

Claims are automatically analysed for high-risk words when created or updated:
- Text is scanned against the RiskConfig collection
- Each match adds to a risk score (low=1, medium=3, high=7)
- Claims receive an overall `riskLevel`: low / medium / high
- High-risk claims appear in the dashboard and analytics

Seed default words at `/admin` → Risk Words → **Seed Defaults**.

---

## Troubleshooting

**MongoDB connection fails** → Check MONGODB_URI in .env, ensure IP is whitelisted in Atlas  
**Redis connection error** → App works without Redis; cron alerts won't run  
**401 on all requests** → Clear localStorage, log in again  
**Risk words not showing** → Go to /admin and click "Seed Defaults"  
**Port conflicts** → Change PORT in backend .env and NEXT_PUBLIC_API_URL in frontend .env.local
