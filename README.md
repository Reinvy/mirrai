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
| `BYOK_ENCRYPTION_KEY` |   | — | 32-byte base64 key untuk encrypt BYOK API keys. Wajib di production, optional di dev. |
| `PORT` |   | `3000` | HTTP port |
| `NODE_ENV` |   | `development` | `production` hides error stack & enables HSTS |
| `ALLOWED_ORIGINS` |   | `http://localhost:3000` | CORS allowlist (comma-separated) |

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
| POST | `/api/auth/register` |   | 20/15min | min pw 8 char |
| POST | `/api/auth/login` |   | 20/15min | |
| POST | `/api/auth/logout` | ✅ | 20/15min | blacklist token |
| GET  | `/api/auth/me` | ✅ | 120/min | |
| PUT  | `/api/auth/me/profile` | ✅ | 30/min | update bio + public flag |
| GET  | `/api/auth/me/quota` | ✅ | 60/min | daily chat quota status |
| POST | `/api/auth/me/upgrade` | ✅ | 5/day | upgrade to Pro tier (dev: no payment) |
| PUT  | `/api/auth/password` | ✅ | 20/15min | invalidate all tokens user |
| DELETE | `/api/auth/me` | ✅ | 20/15min | soft-delete cascade |
| GET  | `/api/auth/me/export` | ✅ | 120/min | download JSON dump |

### Memory

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| GET  | `/api/memory/me` | ✅ | 120/min | list my memories |
| GET  | `/api/memory/insights` | ✅ | 120/min | stats by type, top important |
| GET  | `/api/memory/graph` | ✅ | 30/min | nodes + edges from embedding similarity |
| POST | `/api/memory` | ✅ | 30/min | |
| PUT  | `/api/memory/:id` | ✅ | 30/min | |
| DELETE | `/api/memory/:id` | ✅ | 30/min | |
| POST | `/api/memory/tune` | ✅ | 30/min | manual trigger auto-tune |

### Personality

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| GET  | `/api/personality/me` | ✅ | 120/min | |
| PUT  | `/api/personality/me` | ✅ | 30/min | |
| POST | `/api/personality/me/reset` | ✅ | 30/min | reset to 0.5 |
| GET  | `/api/personality/me/history` | ✅ | 120/min | ?from=&to= date filter |
| GET  | `/api/personality/me/insights` | ✅ | 120/min | trend 7 hari + LLM summary |

### Chat

| Method | Path | Auth | Rate Limit | Catatan |
| ------ | ---- | :--: | :--------: | ------- |
| GET  | `/api/chat` | ✅ | 120/min | paginated history |
| POST | `/api/chat` | ✅ | 10/min | 8-step pipeline |
| POST | `/api/chat/stream` | ✅ | 10/min | **SSE streaming** |
| POST | `/api/chat/playground` | ✅ | 10/min | ephemeral twin vs assistant |
| GET  | `/api/chat/insights` | ✅ | 120/min | daily activity, top emotions |
| GET  | `/api/chat/mood-timeline` | ✅ | 120/min | ?days=7\|30\|90 emotion timeline |
| GET  | `/api/chat/recap` | ✅ | 120/min | ?days=7\|30\|90 LLM summary |
| GET  | `/api/chat/:id` | ✅ | 120/min | single conversation |
| POST | `/api/chat/threads` | ✅ | 60/min | create thread |
| GET  | `/api/chat/threads` | ✅ | 60/min | list my threads |
| PUT  | `/api/chat/threads/:id` | ✅ | 60/min | rename |
| DELETE | `/api/chat/threads/:id` | ✅ | 60/min | delete + cascade |
| POST | `/api/chat/threads/:id/share` | ✅ | 60/min | publish thread (generate slug) |
| DELETE | `/api/chat/threads/:id/share` | ✅ | 60/min | unpublish |

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

> `/me` adalah alias untuk endpoint yang ignore path `:userId` dan pakai user dari JWT.

### SSE Streaming format

`POST /api/chat/stream` mengembalikan Server-Sent Events. Setiap event dipisahkan `\n\n`:

```
data: {"event":"meta","threadId":"...","emotion":{"emotion":"happy","confidence":0.8}}\n\n
data: {"event":"reasoning","reasoning":"..."}\n\n
data: {"event":"delta","text":"Halo"}\n\n
data: {"event":"delta","text":", "}\n\n
data: {"event":"delta","text":"user!"}\n\n
data: {"event":"done","response":"Halo, user!","reasoning":"...","emotion":{...},"personality_snapshot":{...},"threadId":"..."}\n\n
```

Client dapat menutup stream dengan `AbortController`. Conversation baru hanya disimpan setelah event `done`.

## Deployment

Backend bisa di-deploy ke mana saja yang support Node 20+ dan Postgres. Quick options:

- **Fly.io / Railway / Render** — paling cepat
- **VPS** (DigitalOcean, Hetzner) — kontrol penuh, perlu setup sendiri

Set environment variables di platform, jalankan `prisma migrate deploy` saat boot, dan expose port.

## Lisensi

[MIT](../LICENSE) — © 2026 Reinvy
