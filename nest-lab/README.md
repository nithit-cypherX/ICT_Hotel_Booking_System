# ICT Hotel Booking System — REST API

A production-ready REST API for the ICT Hotel Booking System, built with NestJS, TypeScript, Prisma ORM (MySQL), JWT auth, Redis caching, and NGINX as a reverse proxy in front of the full Dockerised stack.

> **Project:** Unit project — *Backend Development*
> **Stack:** NestJS 11 · TypeScript · Prisma · MySQL 8 · Redis · JWT · Swagger · Jest · Docker Compose · NGINX
> **Deployment:** University VM at `http://10.34.112.175/api/` (requires MU-wifi)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Features](#3-features)
4. [Environment Setup](#4-environment-setup)
5. [Running in Development](#5-running-in-development)
6. [Running with Docker](#6-running-with-docker)
7. [API Documentation](#7-api-documentation)
8. [API Usage Examples](#8-api-usage-examples)
9. [Testing](#9-testing)
10. [Caching & Rate Limiting Strategy](#10-caching--rate-limiting-strategy)
11. [Deployment](#11-deployment)
12. [Project Structure](#12-project-structure)
13. [Default Test Accounts](#13-default-test-accounts)
14. [Troubleshooting](#14-troubleshooting)
15. [Known Limitations](#15-known-limitations)

---

## 1. Project Overview

The API serves three types of actors defined in the Hotel Booking Specification:

- **Guests** — unauthenticated users who can browse rooms and search availability.
- **Registered Users** — can create and manage their own bookings.
- **Admins** — can manage rooms (CRUD), upload room images, and change any booking's status.

All functional requirements (FR-1 → FR-38) and non-functional requirements (NFR-1 → NFR-20) from the specification are implemented.

## 2. Architecture

```
                        ┌───────────────────────────┐
  Browser / curl ──►    │  NGINX  (container, :80)  │   ← the only public port
                        │  - /api/ → app:3000       │
                        │  - /uploads/ → static     │
                        └──────────────┬────────────┘
                                       │  Docker internal network
                        ┌──────────────▼────────────┐
                        │ NestJS app  (container,   │
                        │   internal :3000)         │
                        │  - Auth / Rooms /         │
                        │    Bookings / Search /    │
                        │    Notifications / Health │
                        └──────┬────────────┬───────┘
                               │            │
                ┌──────────────▼┐       ┌───▼──────────┐
                │ MySQL 8       │       │ Redis        │
                │ (internal     │       │ (internal    │
                │  :3306)       │       │  :6379)      │
                └───────────────┘       └──────────────┘
```

Key design choices:

- **NGINX reverse proxy** — the only port exposed to the host is `80`. MySQL, Redis and the Node app are on an internal Docker network and cannot be reached from the outside (matches Lab 14).
- **Stateless API** — JWT auth + externalised Redis cache means multiple replicas can run in parallel (NFR-11).
- **Prisma ORM** — typed schema, indexed primary keys, migration files checked into git.
- **Multi-stage Dockerfile** — small final runtime image (~200 MB) running as a non-root user with `tini` as PID 1 for clean shutdowns.

## 3. Features

| Area | FR(s) | Status |
|---|---|---|
| Sign up / login / logout / profile | FR-1 → FR-4 | ✅ |
| Role-Based Access Control (User / Admin) | FR-5 → FR-7 | ✅ (Guards + `@Roles()`) |
| Room CRUD & deactivation | FR-8 → FR-13 | ✅ |
| **Room image upload** | **FR-14 → FR-16** | ✅ (multipart via Multer) |
| Booking create / list / detail | FR-17 → FR-24 | ✅ |
| Date validation & double-booking prevention | FR-19 → FR-20 | ✅ |
| Booking statuses (Pending / Approved / Cancelled / Paid) | FR-21 → FR-22 | ✅ |
| Admin full booking management | FR-25 → FR-26 | ✅ |
| Search rooms by date range / capacity | FR-27 → FR-29 | ✅ |
| Booking event notifications | FR-30 → FR-31 | ✅ |
| Clear error / success messages | FR-32 → FR-34 | ✅ (global `ValidationPipe`) |
| Runs in Docker | FR-35 | ✅ (production Dockerfile + compose) |
| Health check | FR-36 | ✅ (`GET /api/health`) |
| Swagger docs | FR-37 | ✅ (`/api/docs`) |
| Deployed to server | FR-38 | ✅ (uni VM, see §11) |

## 4. Environment Setup

### Prerequisites

- Node.js **20+** and npm **10+** (if running outside Docker)
- Docker **24+** and Docker Compose v2 (if running with Docker — recommended)
- Git

### Clone and configure

```bash
git clone <repo-url> nest-lab
cd nest-lab
git checkout feature/docker-production

cp .env.example .env
# Generate a real JWT secret and paste it into .env
openssl rand -base64 48
```

Open `.env` and fill in values. The only field you **must** change is `JWT_SECRET` — the app refuses to start without a real secret (security fix, NFR-4).

## 5. Running in Development

Option A — Docker (recommended, identical to production):

```bash
docker compose up -d --build
```

Option B — native Node + Docker for DB/Redis only:

```bash
# Start MySQL + Redis in containers
docker compose up -d mysql redis

# In another terminal, run the app natively
npm install
npx prisma migrate dev
npx prisma db seed        # optional: seed admin + sample rooms
npm run start:dev
```

The API will be available at:

- NGINX (Option A):  `http://localhost/api/...`
- Direct Node (Option B): `http://localhost:3000/api/...`

## 6. Running with Docker

### Build the production image standalone

```bash
docker build -t icthotel-api:prod .
```

The Dockerfile uses a three-stage build (deps → builder → runner) to keep the final image small and free of build tools. It runs as an unprivileged user (`nestuser`) and ships with a container-level HEALTHCHECK.

### Full stack with Docker Compose (recommended)

```bash
docker compose up -d --build
docker compose ps            # all 4 containers should be "Up" / healthy
docker compose logs -f app   # follow app logs
```

Stop and remove:

```bash
docker compose down          # keep volumes (DB + uploads)
docker compose down -v       # wipe volumes too (fresh start)
```

## 7. API Documentation

Interactive Swagger UI is available at:

- Local:       `http://localhost/api/docs`
- Uni server:  `http://10.34.112.175/api/docs`

To try authenticated endpoints from the Swagger UI:

1. `POST /api/auth/login` with a seeded account — copy the `access_token` from the response.
2. Click the **Authorize** button (top right) → paste `Bearer <token>`.
3. All protected endpoints are now unlocked in the UI.

## 8. API Usage Examples

Health check:

```bash
curl http://localhost/api/health
# → {"status":"ok","timestamp":"2026-04-18T09:30:00.000Z"}
```

Register:

```bash
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret12345"}'
```

Login:

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"secret12345"}' \
  | jq -r .access_token)
```

Search available rooms:

```bash
curl "http://localhost/api/rooms/search?checkIn=2026-05-01&checkOut=2026-05-05&capacity=2"
```

Create a booking:

```bash
curl -X POST http://localhost/api/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roomId":1,"checkIn":"2026-05-01","checkOut":"2026-05-05"}'
```

Upload a room image (admin only, FR-14):

```bash
curl -X POST http://localhost/api/rooms/1/image \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "file=@./room1.jpg"
# → {"message":"Image uploaded successfully","roomId":1,"imageUrl":"/uploads/room-1713450000000-ab12cd.jpg"}
```

## 9. Testing

Three test levels are implemented (NFR-13):

```bash
npm run test              # unit tests
npm run test:cov          # unit tests with coverage report
npm run test:integration  # integration tests (controller + test DB)
npm run test:e2e          # end-to-end full-flow tests
```

Test-type coverage:

| Level | Files | Covers |
|---|---|---|
| Unit | `src/**/*.spec.ts` | services, validators, business rules (date validation, double-booking logic, role checks, status transitions) |
| Integration | `src/**/*.integration.spec.ts` | Controllers via Supertest, RBAC enforcement, validation error responses |
| E2E | `test/hotel-booking.e2e-spec.ts` | Realistic flow: register → login → search → book → cancel → notification lands in DB |

The E2E tests mock Redis so they can run in CI without a live cache. All tests clean up after themselves using `afterAll`.

## 10. Caching & Rate Limiting Strategy

### Caching (Redis)

| Route | TTL | Why |
|---|---|---|
| `GET /api/rooms` | 30 s | Read-heavy listing page; low cost to be ≤30 s stale |
| `GET /api/rooms/:id` | 30 s | Same as above, per-room |
| `GET /api/rooms/search` | 15 s | Query param variability is high; short TTL gives measurable relief on bursty traffic |

Invalidation is eager — `create`, `update`, `delete`, `attachImage`, and status changes all call `cacheManager.del(...)` on the affected keys so cache never serves stale data after an admin write.

### Rate Limiting (@nestjs/throttler)

| Scope | Limit | Why |
|---|---|---|
| Global default | 30 requests / minute / IP | Baseline abuse protection across every route |
| `POST /api/auth/login` | 5 / minute / IP | Slows password-guessing / credential-stuffing |
| `POST /api/auth/register` | 3 / minute / IP | Limits fake-account creation |
| `POST /api/bookings` | 10 / minute / IP | Prevents booking-spam / scalper behaviour |

Over-limit requests return HTTP **429 Too Many Requests** with a clear error message (FR-32).

## 11. Deployment

The backend is deployed to the ICT university VM via Bitvise SSH + Docker Compose. The branch `feature/docker-production` is the source of truth for the deployed version.

### Deployed endpoints (require MU-wifi)

| Endpoint | URL |
|---|---|
| Health check | `http://10.34.112.175/api/health` |
| Swagger UI | `http://10.34.112.175/api/docs` |
| API base | `http://10.34.112.175/api/` |

### Server connection

| Field | Value |
|---|---|
| Tool | Bitvise SSH Client |
| Host | `10.34.112.175` |
| Port | `22` |
| Username | `student` |
| Password | `ICT.student` (provided by instructor) |

### Deploy steps

On the server, from the repo root:

```bash
# One-shot helper (recommended)
chmod +x deploy.sh
./deploy.sh

# …or manually
git fetch origin
git checkout feature/docker-production
cp .env.example .env        # edit JWT_SECRET etc.
sudo docker compose down
sudo docker compose up -d --build
sudo docker compose ps
sudo docker compose logs -f app
```

Verify from a laptop browser on MU-wifi:

- `http://10.34.112.175/api/health` → returns `{"status":"ok",...}`
- `http://10.34.112.175/api/docs`  → Swagger UI loads
- `http://10.34.112.175:3000/api/health` → **connection refused** (expected — port 3000 is not exposed publicly; this is a security feature, not a bug)

## 12. Project Structure

```
nest-lab/
├── Dockerfile                      ← multi-stage production build
├── docker-compose.yml              ← NGINX + app + MySQL + Redis stack
├── deploy.sh                       ← one-shot deployment helper
├── .dockerignore
├── .env.example                    ← template — copy to .env
├── nginx/
│   └── default.conf                ← reverse-proxy config (from Lab 14)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts                     ← bootstrap, global /api prefix, /uploads static
│   ├── app.module.ts               ← Redis cache + throttler wiring
│   ├── app.controller.ts           ← health endpoint
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts          ← JWT_SECRET now required (no fallback)
│   │   ├── jwt.strategy.ts         ← JWT_SECRET now required (no fallback)
│   │   ├── guards/, decorators/, dto/
│   ├── rooms/
│   │   ├── rooms.controller.ts     ← + POST /rooms/:id/image (FR-14)
│   │   ├── rooms.service.ts        ← + attachImage(...)
│   │   └── dto/
│   ├── bookings/
│   ├── notifications/
│   └── prisma/
└── test/
    └── hotel-booking.e2e-spec.ts
```

## 13. Default Test Accounts

After running `npx prisma db seed` (or on first deploy with the seed enabled):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@icthotel.test` | `Admin12345!` |
| User  | `user@icthotel.test`  | `User12345!` |

> **Production note:** change these credentials before any real deployment. They are deliberately simple for grading.

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| App refuses to start with `JWT_SECRET` error | `.env` missing or still has placeholder | `openssl rand -base64 48` → paste into `.env` |
| `502 Bad Gateway` from NGINX | App container not healthy yet | Wait 30–60 s then `docker compose logs app` |
| Port `80` already in use | Native NGINX running on host | `sudo service nginx stop` |
| `docker compose up` hangs on MySQL | First run, MySQL initialising | Wait — healthcheck retries 10× |
| Uploads return 404 | Docker volume not mounted | Ensure `uploads_data` volume exists in `docker compose ps -a` |
| `curl localhost:3000` fails | **Intentional** — only NGINX (`:80`) is public | Use `http://localhost/api/...` instead |

Logs for each service:

```bash
docker compose logs -f nginx   # proxy layer
docker compose logs -f app     # NestJS app
docker compose logs -f mysql
docker compose logs -f redis
```

## 15. Known Limitations

- **Image storage is a Docker named volume, not object storage.** Suitable for a single VM; scaling to multiple replicas would require migrating to S3 / MinIO.
- **No HTTPS in front of NGINX** on the uni VM (course requirement is HTTP only). In real production, add Let's Encrypt + HTTPS redirect.
- **No password reset flow** — intentionally out of scope per the specification.
- **Notifications are DB rows only** — no push / email delivery. The spec asks for events to be recorded so the frontend can poll; both FR-30 and FR-31 are satisfied by the current design.
- **Seed credentials** are public in the repo. This is fine for grading but must be rotated before real use.

---

*Last updated: April 2026*
