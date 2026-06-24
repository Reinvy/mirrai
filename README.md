# 🧠🪞 MirrAI Backend

> Express API untuk **digital-twin AI** yang berevolusi dari interaksi user. Bagian backend dari monorepo [MirrAI](../).

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Express 4.16 (CommonJS)
- **ORM:** Prisma 7 (driver-adapter pattern, output ke `app/generated/prisma`)
- **AI:** LangChain 1 + `@langchain/openai` (kompatibel dengan OpenAI / OpenRouter / self-hosted)
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
| `OPENAI_API_KEY` | ✅* | — | API key LLM provider |
| `OPENROUTER_API_KEY` | ✅* | — | Alternatif, dibaca sebagai fallback `OPENAI_API_KEY` |
| `OPENAI_MODEL` |   | `gpt-4o-mini` | Model name |
| `OPENAI_API_BASE_URL` |   | — | Override base URL (untuk OpenRouter, self-host, dll) |
| `OPENAI_TEMPERATURE` |   | `0.7` | LLM temperature |
| `PORT` |   | `3000` | HTTP port |
| `NODE_ENV` |   | `development` | `production` hides error stack & enables HSTS |
| `ALLOWED_ORIGINS` |   | `http://localhost:3000` | CORS allowlist (comma-separated) |

\* salah satu dari `OPENAI_API_KEY` atau `OPENROUTER_API_KEY` harus ada.

## Arsitektur

```
Client → Express → Module Router → Controller → Service → Prisma / LLM Chain
                                                ↓
                                  Emotion / Memory / Personality / Thought / Decision
```

### 8-Step Chat Pipeline

`POST /api/chat` menjalankan pipeline 8 langkah (lihat `app/modules/chat/chat-service.js`):

1. Create thread baru (jika belum ada `threadId`)
2. **Concurrent:** detect emotion, retrieve memory, get personality
3. Generate thought (internal reasoning)
4. Generate decision (final response)
5. Save conversation
6. Save memory (SHORT_TERM, importance 0.4–0.7)
7. Evolve personality (delta dari emotion weights)
8. Generate thread title (background, LLM)

## Struktur Project

```
mirrai/
├── app/
│   ├── modules/
│   │   ├── auth/         # register, login, logout, /me
│   │   ├── memory/       # CRUD + semantic search
│   │   ├── personality/  # traits, history
│   │   └── chat/         # chat pipeline + threads
│   ├── services/         # emotion, thought, decision, evolution, token cleanup
│   ├── llm/              # chains + prompts
│   ├── middlewares/      # token-verify, error-handler
│   ├── config/           # db, embedding, openai, logger, openapi
│   ├── utils/            # app-error, response-formatter
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

| Method | Path | Auth | Rate Limit |
| ------ | ---- | :--: | :--------: |
| POST | `/api/auth/register` |   | 20/15min |
| POST | `/api/auth/login` |   | 20/15min |
| POST | `/api/auth/logout` | ✅ | 20/15min |
| GET  | `/api/auth/me` | ✅ | 120/min |
| GET  | `/api/memory/me` | ✅ | 120/min |
| POST | `/api/memory` | ✅ | 30/min |
| PUT  | `/api/memory/:id` | ✅ | 30/min |
| DELETE | `/api/memory/:id` | ✅ | 30/min |
| GET  | `/api/personality/me` | ✅ | 120/min |
| PUT  | `/api/personality/me` | ✅ | 30/min |
| GET  | `/api/personality/me/history` | ✅ | 120/min |
| GET  | `/api/chat` | ✅ | 120/min |
| POST | `/api/chat` | ✅ | 10/min |
| POST | `/api/chat/playground` | ✅ | 10/min |
| CRUD | `/api/chat/threads` | ✅ | 60/min |
| GET  | `/api-docs.json` |   | — |
| GET  | `/docs` |   | — |

> `/me` adalah alias untuk endpoint yang ignore path `:userId` dan pakai user dari JWT.

## Deployment

Backend bisa di-deploy ke mana saja yang support Node 20+ dan Postgres. Quick options:

- **Fly.io / Railway / Render** — paling cepat
- **VPS** (DigitalOcean, Hetzner) — kontrol penuh, perlu setup sendiri

Set environment variables di platform, jalankan `prisma migrate deploy` saat boot, dan expose port.

## Lisensi

[MIT](../LICENSE) — © 2026 Reinvy
