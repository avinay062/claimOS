# ClaimsOS — Phase 1 + Phase 2

Veeva Claims competitor SaaS — Next.js 14, Node.js, MongoDB, AWS S3, BullMQ, Resend.

## Quick Start

### Backend
```bash
cd backend && cp .env.example .env  # fill in all vars
npm install && npm run dev          # port 5000
```

### Frontend
```bash
cd frontend && cp .env.local.example .env.local
npm install && npm run dev          # port 3000
```

### Redis (needed for queues)
```bash
docker run -d -p 6379:6379 redis:alpine
```

## Phase 2 New Files

### Backend
- src/models/Substantiation.js       — evidence document model
- src/models/ClaimSubstantiation.js  — many-to-many join
- src/models/WorkflowTask.js         — workflow task model
- src/models/Notification.js         — in-app notification model
- src/routes/substantiations.js      — CRUD, S3 upload, bulk link
- src/routes/tasks.js                — task CRUD + complete/start
- src/routes/notifications.js        — notification feed
- src/services/emailService.js       — Resend email templates
- src/services/notificationService.js— in-app notify helper
- src/services/workflowTaskService.js— task create + notify
- src/middleware/upload.js            — multer S3 middleware
- src/config/s3.js                   — AWS S3 client
- src/config/redis.js                — BullMQ + IORedis config
- src/workers/cronJobs.js            — overdue/reminder/reassessment crons

### Frontend
- app/substantiations/page.tsx       — list, create, upload
- app/substantiations/[id]/page.tsx  — detail, link claims, bulk link
- app/claims/[id]/page.tsx           — full lifecycle, tasks, e-sigs
- app/tasks/page.tsx                 — My Tasks with complete action
- components/layout/AppLayout.tsx    — updated: notif bell, task badge

## Claim Lifecycle
proposed → substantiation_dev → substantiation_complete → in_review → approved → in_market
         ↘ no_evidence_found                                      ↘ rejected / withdrawn
