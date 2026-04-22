# 🏨 ICT Hotel Booking System — REST API

A production-ready Hotel Booking REST API built with **NestJS**, **TypeScript**, **Prisma ORM (MySQL)**, **Redis**, and **JWT authentication**. Fully documented with Swagger/OpenAPI, tested at unit/integration/E2E levels, and containerized with Docker + NGINX.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Environment Setup](#environment-setup)
- [How to Run in Development (Without Docker)](#how-to-run-in-development-without-docker)
- [How to Run with Docker](#how-to-run-with-docker)
- [How to Build and Run Docker Image(s)](#how-to-build-and-run-docker-images)
- [API Documentation (Swagger)](#api-documentation-swagger)
- [API Usage Examples](#api-usage-examples)
- [API Testing](#api-testing)
- [How the System is Deployed](#how-the-system-is-deployed)

---

## Project Overview

The ICT Hotel Booking System is a RESTful back-end service that allows:

- **Guests** to browse available hotel rooms
- **Registered Users** to create and manage their own bookings
- **Admins** to manage rooms, view all bookings, and update booking statuses

The system enforces JWT-based authentication, Role-Based Access Control (RBAC), double-booking prevention, Redis caching for performance, and rate limiting for abuse protection.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Client (HTTP)                    │
└────────────────────────┬────────────────────────────┘
                         │ Port 80
┌────────────────────────▼────────────────────────────┐
│                NGINX Reverse Proxy                  │
│         Routes /api/* → NestJS app:3000             │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              NestJS Application (Port 3000)         │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────┐ │
│  │   Auth   │ │  Rooms   │ │ Bookings  │ │Notifs │ │
│  │ Module   │ │  Module  │ │  Module   │ │Module │ │
│  └──────────┘ └──────────┘ └───────────┘ └───────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │            Prisma ORM (MySQL Client)         │   │
│  └──────────────────────────────────────────────┘   │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
┌──────────▼───────┐    ┌──────────▼──────────────────┐
│   MySQL 8.0      │    │        Redis (Cache)         │
│   (Primary DB)   │    │  (Room list caching,         │
│                  │    │   Rate limiting store)        │
└──────────────────┘    └─────────────────────────────┘
```

### Module Structure

```
src/
├── app.module.ts              ← Root module (Redis cache + throttler setup)
├── app.controller.ts          ← Health check endpoint (GET /api/health)
├── main.ts                    ← Bootstrap, Swagger config, ValidationPipe
├── auth/
│   ├── auth.controller.ts     ← POST /api/auth/register, /login, /logout, GET /api/auth/me
│   ├── auth.service.ts        ← bcrypt hashing, JWT signing, profile management
│   ├── jwt.strategy.ts        ← Passport JWT strategy
│   ├── guards/
│   │   ├── jwt-auth.guard.ts  ← Protects authenticated routes
│   │   └── roles.guard.ts     ← Enforces role-based access (USER / ADMIN)
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       └── update-profile.dto.ts
├── rooms/
│   ├── rooms.controller.ts    ← CRUD for rooms (Admin), public listing, search
│   ├── rooms.service.ts       ← Room business logic, availability search
│   └── dto/
│       ├── create-room.dto.ts
│       └── update-room.dto.ts
├── bookings/
│   ├── bookings.controller.ts ← Booking CRUD, admin status update
│   ├── bookings.service.ts    ← Date validation, double-booking prevention
│   └── dto/
│       ├── create-booking.dto.ts
│       └── update-status.dto.ts
├── notifications/
│   ├── notifications.controller.ts
│   ├── notifications.service.ts
│   └── dto/
│       └── create-notification.dto.ts
└── prisma/
    ├── prisma.module.ts        ← Global Prisma module
    └── prisma.service.ts       ← Prisma client wrapper
```

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| NestJS | 11.x | Backend framework |
| TypeScript | 5.x | Programming language |
| Prisma ORM | Latest | Database access layer |
| MySQL | 8.0 | Primary relational database |
| JWT | via @nestjs/jwt | Authentication tokens |
| bcrypt | Latest | Password hashing (salt rounds: 12) |
| Redis | Alpine | Caching & rate limiting store |
| Swagger/OpenAPI | @nestjs/swagger 11.x | API documentation |
| Jest + Supertest | 30.x / 7.x | Unit, integration, and E2E testing |
| Docker | Latest | Containerization |
| Docker Compose | Latest | Multi-service orchestration |
| NGINX | Alpine | Reverse proxy (port 80) |

---

## Environment Setup

### Prerequisites

- Node.js >= 18
- npm >= 9
- MySQL 8.0 (or Docker)
- Redis (or Docker)
- Git

### 1. Clone the repository

> 📌 Clone from **GitHub Classroom** — link provided separately.
```bash
clone https://github.com/MUICT-Class/682-project-group14.git
or
clone https://github.com/nithit-cypherX/ICT_Hotel_Booking_System.git
```

```bash
cd nest-lab
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

`.env.example` is pre-filled with working local defaults. The only value you **must change** is `JWT_SECRET` — replace it with any long random string:

```env
# Application
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="mysql://hoteluser:hotelpass@localhost:3306/hotel_booking"

# JWT — Change this to any long random string before running
JWT_SECRET=replace_this_with_a_long_random_secret_string
JWT_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

> ⚠️ Never commit your `.env` file. It is listed in `.gitignore`.

### 4. Set up the database

```bash
# Run database migrations
npx prisma migrate deploy

# Seed the database with test data
npx prisma db seed
```

**Seed creates these test accounts:**

| Username | Password | Role |
|----------|----------|------|
| `admin` | `12345678` | ADMIN |
| `user01` | `12345678` | USER |

---

## How to Run in Development (Without Docker)

> ⚠️ Make sure MySQL and Redis are running locally before starting.

```bash
# Watch mode (hot reload) — recommended for development
npm run start:dev

# Standard mode
npm run start

# Production mode (requires build first)
npm run build
npm run start:prod
```

| Endpoint | URL |
|---|---|
| API Base | `http://localhost:3000/api` |
| Health Check | `http://localhost:3000/api/health` |
| Swagger UI | `http://localhost:3000/api/docs` |

---

## How to Run with Docker

The `docker-compose.yml` starts all four services together: **NGINX**, **NestJS app**, **MySQL**, and **Redis**.

### Start all services

```bash
docker compose up -d --build
```

### Stop all services

```bash
docker compose down
```

### View app logs

```bash
docker compose logs -f app
```

### Run migrations and seed (first time only)

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

| Endpoint | URL (via NGINX — no port needed) |
|---|---|
| API Base | `http://localhost/api` |
| Health Check | `http://localhost/api/health` |
| Swagger UI | `http://localhost/api/docs` |

> NGINX handles all routing on port 80. No port number is needed in the URL.

---

## How to Build and Run Docker Image(s)

The project uses a multi-stage `Dockerfile` to produce a lean production image.

### Build the image

```bash
docker build -t ict-hotel-booking:latest .
```

### Run the container

```bash
docker run -d \
  --name ict-hotel-booking \
  -p 3000:3000 \
  -e DATABASE_URL="mysql://hoteluser:hotelpass@your-mysql-host:3306/hotel_booking" \
  -e JWT_SECRET="your_long_random_secret" \
  -e REDIS_HOST="your-redis-host" \
  -e REDIS_PORT="6379" \
  -e NODE_ENV="production" \
  ict-hotel-booking:latest
```

### Verify the container is running

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

> ⚠️ The standalone image requires **MySQL and Redis to be running separately** and reachable at the configured `DATABASE_URL` and `REDIS_HOST` before the health check will respond. For a fully working local setup with all services included, use `docker compose up -d --build` instead.

---

## API Documentation (Swagger)

Interactive Swagger UI is available at:

| Environment | Swagger URL |
|---|---|
| Local (without Docker) | `http://localhost:3000/api/docs` |
| Local (with Docker) | `http://localhost/api/docs` |
| Deployed (uni server) | `http://10.34.112.175/api/docs` |

### How to authenticate in Swagger

1. Open Swagger UI in your browser
2. Call `POST /api/auth/login` with your credentials and click **Execute**
3. Copy the `access_token` value from the response
4. Click the **"Authorize"** button at the top right of the page
5. Enter: `Bearer <your_access_token>`
6. Click **Authorize** — all subsequent requests will include your token automatically

---

## API Usage Examples

All endpoints can be tested directly in **Swagger UI** at `/api/docs`. Below is a guide to the key flows.

### Authentication

| Step | Endpoint | Description |
|------|----------|-------------|
| 1 | `POST /api/auth/register` | Register with `username`, `name`, `email`, `password` |
| 2 | `POST /api/auth/login` | Login with `email` + `password` → get `access_token` |
| 3 | `GET /api/auth/me` | View your profile *(requires token)* |
| 4 | `PATCH /api/auth/me` | Update your profile *(requires token)* |

### Rooms

| Step | Endpoint | Access |
|------|----------|--------|
| List rooms | `GET /api/rooms` | Public |
| Room details | `GET /api/rooms/:id` | Public |
| Search available rooms | `GET /api/rooms/search?checkIn=&checkOut=&capacity=` | Public |
| Create room | `POST /api/rooms` | Admin only |
| Update room | `PATCH /api/rooms/:id` | Admin only |
| Disable room | `PATCH /api/rooms/:id/disable` | Admin only |
| Delete room | `DELETE /api/rooms/:id` | Admin only |

### Bookings

| Step | Endpoint | Access |
|------|----------|--------|
| Create booking | `POST /api/bookings` | User (body: `roomId`, `checkIn`, `checkOut`) |
| My bookings | `GET /api/bookings` | User (own only) / Admin (all) |
| Booking detail | `GET /api/bookings/:id` | User (own only) |
| Update status | `PATCH /api/bookings/:id/status` | Admin only (`PENDING`, `APPROVED`, `CANCELLED`, `PAID`) |

### Notifications

| Endpoint | Description |
|----------|-------------|
| `GET /api/notifications` | View notifications (created automatically on booking events) |

### Health Check

| Endpoint | Expected Response |
|----------|------------------|
| `GET /api/health` | `{"status":"ok","timestamp":"..."}` |

---

## API Testing

> ⚠️ **Tests run locally only — not inside Docker.**
> The test suite is intentionally excluded from the Docker image to keep the production image lean and reduce build size. Run all tests on your local machine with Node.js installed.

### Test Commands

```bash
# Unit tests
npm run test

# Unit tests in watch mode
npm run test:watch

# Integration tests
npm run test -- --testPathPattern=integration

# End-to-End tests
npm run test:e2e

# All tests with coverage report
npm run test:cov
```

---

### Unit Tests

Tests core business logic in isolation using mocked dependencies.

**Files:** `src/auth/auth.service.spec.ts`, `src/rooms/rooms.service.spec.ts`, `src/bookings/bookings.service.spec.ts`, `src/prisma/prisma.service.spec.ts`

**Coverage:** Registration, login, room CRUD, date validation, double-booking detection, status transitions, notification triggers.

**Expected output:**

```
PASS src/auth/auth.service.spec.ts
PASS src/rooms/rooms.service.spec.ts
PASS src/bookings/bookings.service.spec.ts
PASS src/prisma/prisma.service.spec.ts

Test Suites: 4 passed, 4 total
Tests:       28 passed, 28 total
```

---

### Integration Tests

Tests HTTP layer using Supertest with mocked services. Covers status codes, guard behavior (401/403), and validation.

**Files:** `src/auth/auth.controller.integration.spec.ts`, `src/rooms/rooms.controller.integration.spec.ts`

```bash
npm run test -- --testPathPattern=integration
```

---

### End-to-End Tests

Full realistic user/admin flow against a real test database. Redis is mocked for compatibility.

**File:** `test/hotel-booking.e2e-spec.ts`

**Flow:** Register → Login → Create room (admin) → Search → Book → Verify ownership → Approve → Cancel → Check notifications

**Expected output:**

```
PASS test/hotel-booking.e2e-spec.ts
  Hotel Booking E2E
    ✓ should register a new user
    ✓ should login and return access token
    ✓ admin should create a room
    ✓ user should search available rooms
    ✓ user should create a booking
    ✓ other user should not access booking (403)
    ✓ admin should approve booking
    ✓ user should cancel booking
    ✓ cancellation notification should be recorded
    ✓ user should view notifications

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

---

## How the System is Deployed

The application is deployed to the **university-provided VM**, accessible over the university VPN (MU-wifi).

### Deployed Environment

| Item | Detail |
|---|---|
| Server | University VM |
| OS | Ubuntu 22.04 LTS |
| Stack | Docker + Docker Compose + NGINX |
| Base URL | `http://10.34.112.175/api` |
| Swagger UI | `http://10.34.112.175/api/docs` |
| Health Check | `http://10.34.112.175/api/health` |

> 🔒 Must be connected to **MU-wifi** or university VPN to access.

### Test Accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `12345678` | ADMIN |
| `user01` | `12345678` | USER |

> These are seeded test accounts for evaluation purposes only.

### Step-by-Step Deployment

#### 1. SSH into the server

```bash
ssh student@10.34.112.175
# Password: ICT.student
```

#### 2. Clone the repository

```bash
cd ~
git clone <github-classroom-url> group14
cd group14/nest-lab
```

#### 3. Create the `.env` file

```bash
cp .env.example .env
nano .env   # Set JWT_SECRET and verify all values
```

#### 4. Build and start all containers

```bash
docker compose up -d --build
```

This starts four containers:

| Container | Role | Exposed |
|---|---|---|
| `icthotel-nginx` | NGINX reverse proxy | Port 80 (public) |
| `nest-app-prod` | NestJS application | Port 3000 (internal) |
| `icthotel-mysql` | MySQL 8.0 database | Internal only |
| `icthotel-redis` | Redis cache | Internal only |

#### 5. Run database migrations and seed

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

#### 6. Verify deployment

```bash
curl http://localhost/api/health
# {"status":"ok","timestamp":"..."}
```

### CI/CD — Automatic Deployment

The project includes a `.gitlab-ci.yml` pipeline that automatically deploys on every push to `main`:

1. GitLab Runner SSHs into the university server
2. Server pulls latest code: `git pull origin main`
3. Docker rebuilds and restarts all containers: `docker compose up -d --build`
4. Old images are pruned to save disk space

No manual SSH required after initial setup.

---

