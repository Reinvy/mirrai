# 🧠🪞 MirrAI Backend

> Express API untuk **digital-twin AI** yang berevolusi dari interaksi user. Bagian backend dari monorepo [MirrAI](../).

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 4.16 (CommonJS)
- **ORM:** Prisma 7 (driver-adapter pattern, output ke `app/generated/prisma`)
- **AI:** LangChain 1 + `@langchain/openai` (OpenAI-compatible: OpenAI, self-hosted gateway, BYOK)
- **Embedding:** `@huggingface/transformers` (`nomic-ai/nomic-embed-text-v1.5`, 768-dim, **lokal**)
- **Vector Store:** `pgvector` (table `langchain_pg_embeddings`)
- **DB:** PostgreSQL 14+ dengan ekstensi `pgvector`
- **Logging:** Winston + daily rotate file
- **API docs:** Scalar UI di `/docs`, OpenAPI spec di `/api-docs.json`

## Quick Start

```bash
cp .env.example .env
# edit .env — wajib: DATABASE_URL, JWT_SECRET (min 32 char), OPENAI_API_KEY
npm install
npx prisma generate                # output ke app/generated/prisma (gitignored)
npx prisma migrate deploy
npx prisma db seed                 # opsional, data demo (1 user, memories, personality)
npm start                          # port dari PORT, default 3000
```

Buka `http://localhost:3000/docs` untuk Scalar API reference.

## Menjalankan Test

```bash
npm test                           # jest --runInBand, butuh Postgres
npx jest tests/auth.test.js --runInBand
```

Test adalah **integration test** — boot Express app via supertest, hit DB real. Butuh `mirrai_test` database:

```bash
createdb mirrai_test
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mirrai_test \
  npx prisma migrate deploy
```

## Environment Variables

| Var | Wajib | Default | Keterangan |
| --- | :---: | --- | --- |
| `DATABASE_URL` | ✅ | — | Postgres connection string |
| `JWT_SECRET` | ✅ | — | Min 32 char, random |
| `JWT_EXPIRATION` |   | `8h` | Token lifetime |
| `OPENAI_API_KEY` | ✅ | — | API key LLM provider |
| `OPENAI_MODEL` |   | `deepseek-v4-flash` | Model name |
| `OPENAI_API_BASE_URL` |   | — | Override base URL (untuk self-hosted gateway, dll) |
| `OPENAI_TEMPERATURE` |   | `0.7` | LLM temperature |
| `BYOK_ENCRYPTION_KEY` |   | — | 32-byte base64 key untuk encrypt BYOK API keys. Wajib di production (boot gagal tanpa ini), optional di dev. |
| `BYOK_ALLOW_PRIVATE_HOSTS` |   | `false` | Izinkan BYOK `baseUrl` ke host privat/loopback (mis. Ollama lokal). Metadata cloud tetap diblokir. |
| `LLM_TIMEOUT_MS` |   | `60000` | Timeout per request LLM |
| `LLM_MAX_RETRIES` |   | `1` | Retry otomatis saat provider gagal |
| `OPENAI_MAX_TOKENS` |   | `2048` | Batas token output |
| `PORT` |   | `3000` | HTTP port |
| `NODE_ENV` |   | `development` | `production` hides error stack & enables HSTS |
| `TRUST_PROXY` |   | `0` | Jumlah reverse proxy di depan app (0 = nonaktif). Set `1` di belakang 1 proxy agar limiter melihat IP asli. |
| `ENABLE_DEV_UPGRADE` |   | `true` | Izinkan `POST /auth/me/upgrade` tanpa payment provider. Production default menolak (403) kecuali di-set `true`. |
| `ALLOWED_ORIGINS` |   | `http://localhost:3000` | CORS allowlist (comma-separated). Origin di luar list tidak mendapat header CORS. |

## Arsitektur

```
Client → Express → Module Router → Controller → Service → Prisma / LLM Chain
                                                ↓
                                  Emotion / Memory / Personality / Thought / Decision
```

### 8-Step Chat Pipeline

`POST /api/chat` menjalankan pipeline 8 langkah (lihat `app/modules/chat/chat-service.js`):

1. Create thread baru (jika belum ada `threadId`) + cek quota
2. **Concurrent:** detect emotion, retrieve long-term memory, get personality, get recent thread context (5 pesan terakhir), get personality trend
3. **Concurrent:** generate internal thought (sudut pandang user) + extract memory baru
4. Generate response (sebagai digital twin, dengan profil + thread context)
5. Save conversation
6. Save memory (1 SHORT_TERM raw + N extracted LONG_TERM/SEMANTIC/EMOTIONAL)
7. Evolve personality (emotion delta + memory-pattern drift, max ±0.01/turn)
8. Generate thread title (background, LLM)

### Digital Twin Identity

System prompt digital twin dibangun dari 7 blok konsisten (lihat `app/llm/prompts/chat-prompt.js`):

1. **Profil** — nama & bio user
2. **Personality** — 5 traits + style rules hasil pemetaan otomatis
3. **Emosi** — label + confidence + cara interpretasi
4. **Memory relevan** — hasil semantic search
5. **Konteks thread** — 5 pesan terakhir percakapan di thread ini
6. **Internal reasoning** — apa yang user pikirkan sebelum menjawab
7. **Aturan respons** — bahasa, sudut pandang, larangan menyebut AI

## Struktur Project

```
mirrai/
├── app/
│   ├── modules/
│   │   ├── auth/         # register, login, logout, /me, quota, profile
│   │   ├── memory/       # CRUD + semantic search + graph + insights
│   │   ├── personality/  # traits, history, insights
│   │   ├── chat/         # pipeline + threads + stream + insights + recap + playground + public
│   │   └── byok/         # user-supplied LLM keys (encrypted)
│   ├── services/         # emotion, evolution, insights, llm-resolver, memory-extraction, memory-tuning, quota, recap, response, token-cleanup
│   ├── llm/              # chains (chat, emotion, memory-extraction, assistant) + prompts + format + style-rules
│   ├── middlewares/      # token-verify, error-handler
│   ├── config/           # db, embedding, openai, logger, openapi
│   ├── utils/            # app-error, crypto (BYOK), response-formatter
│   └── generated/prisma/ # gitignored
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js           # demo data
├── tests/                # integration tests
└── bin/www               # HTTP server bootstrap
```

## API Endpoints

Lihat Scalar UI di `http://localhost:3000/docs` untuk dokumentasi lengkap dengan schema dan contoh.

### Auth

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| POST | `/api/auth/register` |   | 20/15min | min pw 8 char, nama unik |
| POST | `/api/auth/login` |   | 20/15min | |
| POST | `/api/auth/logout` | ✅ | 120/min | blacklist token (idempotent) |
| GET  | `/api/auth/me` | ✅ | 120/min | termasuk `onboardingCompleted` |
| PUT  | `/api/auth/me/profile` | ✅ | 30/min | update bio + public flag |
| GET  | `/api/auth/me/quota` | ✅ | 120/min | daily chat quota status |
| POST | `/api/auth/me/upgrade` | ✅ | 30/min | upgrade to Pro (403 di production tanpa `ENABLE_DEV_UPGRADE=true`) |
| PUT  | `/api/auth/password` | ✅ | 30/min | invalidate all tokens user |
| DELETE | `/api/auth/me` | ✅ | 30/min | soft-delete cascade, unpublish threads, free username |
| GET  | `/api/auth/me/export` | ✅ | 120/min | download JSON dump (tanpa password/BYOK key) |

### Memory

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| GET  | `/api/memory/me` | ✅ | 120/min | list my memories (`?query=` untuk semantic search) |
| GET  | `/api/memory/insights` | ✅ | 120/min | stats by type, top important |
| GET  | `/api/memory/graph` | ✅ | 120/min | `?limit=1-200&threshold=0.5-0.99`, nodes + edges |
| POST | `/api/memory` | ✅ | 30/min | `associations[]`, `emotionalValence` |
| PUT  | `/api/memory/:id` | ✅ | 30/min | 404 bila bukan milikmu / sudah dihapus |
| DELETE | `/api/memory/:id` | ✅ | 30/min | 404 bila tidak ada |
| POST | `/api/memory/tune` | ✅ | 30/min | manual trigger auto-tune |

### Personality

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| GET  | `/api/personality/me` | ✅ | 120/min | |
| PUT  | `/api/personality/me` | ✅ | 120/min | tiap trait harus angka 0.1–1.0 |
| POST | `/api/personality/me/reset` | ✅ | 120/min | reset to 0.5 |
| GET  | `/api/personality/me/archetype` | ✅ | 120/min | dihitung dari data nyata + dipersist |
| POST | `/api/personality/me/onboarding` | ✅ | 120/min | set `onboardingCompleted=true` |
| GET  | `/api/personality/me/history` | ✅ | 120/min | ?from=&to= date filter |
| GET  | `/api/personality/me/insights` | ✅ | 120/min | `?summary=1` untuk narasi LLM (cache 10 menit) |

### Chat

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| GET  | `/api/chat` | ✅ | 120/min | paginated history (`persona`, `partial` per item) |
| POST | `/api/chat` | ✅ | 30/min | 8-step pipeline; body: `message`, `threadId?`, `attachments?`, `persona?` |
| POST | `/api/chat/stream` | ✅ | 30/min | **SSE streaming**, preflight error = JSON |
| POST | `/api/chat/playground` | ✅ | 30/min | `{message, personalityOverride?}` twin vs assistant |
| GET  | `/api/chat/insights` | ✅ | 120/min | daily activity, top emotions |
| GET  | `/api/chat/mood-timeline` | ✅ | 120/min | ?days=1..90 emotion timeline |
| GET  | `/api/chat/recap` | ✅ | 30/min | ?days=7\|30\|90 LLM summary (consume quota) |
| GET  | `/api/chat/:id` | ✅ | 120/min | single conversation |
| POST | `/api/chat/threads` | ✅ | 60/min | create thread |
| GET  | `/api/chat/threads` | ✅ | 120/min | list my threads |
| PUT  | `/api/chat/threads/:id` | ✅ | 60/min | rename |
| DELETE | `/api/chat/threads/:id` | ✅ | 60/min | delete + cascade |
| POST | `/api/chat/threads/:id/share` | ✅ | 60/min | publish thread (random 128-bit slug) |
| DELETE | `/api/chat/threads/:id/share` | ✅ | 60/min | unpublish |

`threadId` yang bukan milik user, sudah dihapus, atau tidak ada → `404 {"message":"Thread tidak ditemukan"}`.

### Dream (Subconscious)

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| POST | `/api/dream/consolidate` | ✅ | 30/min | konsolidasi memori baru → `DreamEntry`; <2 memori → 400, payload LLM invalid → 502 |
| GET  | `/api/dream/daily-resonance` | ✅ | 30/min | satu resonance per (user, hari lokal), deterministik |
| GET  | `/api/dream/journal` | ✅ | 30/min | 30 entry konsolidasi terbaru |

### Simulation

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| POST | `/api/simulation/branch` | ✅ | 30/min | `{scenario, title?}` → 3 cabang |
| POST | `/api/simulation/council` | ✅ | 30/min | `{dilemma, title?}` → transkrip + consensus |
| GET  | `/api/simulation` | ✅ | 30/min | riwayat 20 sesi terakhir |
| GET  | `/api/simulation/:id` | ✅ | 30/min | detail, 404 bila bukan milikmu |

### Public (no auth)

| Method | Path | Auth | Catatan |
| ------ | ---- | :--: | ------- |
| GET  | `/api/chat/shared/:slug` |   | read shared thread |
| GET  | `/api/chat/users/:username` |   | public profile (if enabled) |
| GET  | `/api/chat/users/:username/threads` |   | public threads list |
| GET  | `/api/chat/compare?u1=&u2=` |   | compare 2 public profiles |

### Docs

| Method | Path | Auth | Catatan |
| ------ | ---- | :--: | ------- |
| GET  | `/api-docs.json` |   | OpenAPI spec |
| GET  | `/docs` |   | Scalar UI |

> Endpoint resource selalu memakai user dari JWT. Route berbasis `:userId` sudah dihapus; gunakan `/me`.

### SSE Streaming format

`POST /api/chat/stream` mengembalikan Server-Sent Events. Setiap event dipisahkan `\n\n`:

```
data: {"event":"meta","threadId":"...","emotion":{"emotion":"happy","confidence":0.8},"persona":"twin"}\n\n
data: {"event":"reasoning","reasoning":"..."}\n\n
data: {"event":"delta","text":"Halo"}\n\n
data: {"event":"delta","text":", "}\n\n
data: {"event":"delta","text":"user!"}\n\n
data: {"event":"title","threadId":"...","title":"Topik Singkat"}\n\n
data: {"event":"done","response":"Halo, user!","reasoning":"...","emotion":{...},"personality_snapshot":{...},"threadId":"...","persona":"twin","partial":false}\n\n
```

- Error preflight (401/404/429/400) dikirim sebagai JSON sebelum header SSE dikirim.
- Bila client menutup stream (`AbortController`), potongan respons yang sudah terkirim
  tetap disimpan sebagai `Conversation.partial = true`; thread kosong yang baru dibuat
  ikut di-soft-delete dan kuota dikembalikan.

## Deployment

Backend bisa di-deploy ke mana saja yang support Node 20+ dan Postgres. Quick options:

- **Fly.io / Railway / Render** — paling cepat
- **VPS** (DigitalOcean, Hetzner) — kontrol penuh, perlu setup sendiri

Set environment variables di platform, jalankan `prisma migrate deploy` saat boot, dan expose port.

## Lisensi

[MIT](../LICENSE) — © 2026 Reinvy
