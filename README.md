# 🧠🪞 MirrAI

> **An evolving AI that reflects your thoughts, learns from your behavior, and grows with you over time.**

---

## ✨ Overview

**MirrAI** is an experimental AI system designed to act as a **digital reflection of its user** — not just answering questions, but understanding patterns, adapting personality, and evolving continuously.

Unlike traditional assistants, MirrAI is built to:

- remember what matters
- adapt how it responds
- and gradually become a **mirror of your thinking and behavior**

> It doesn’t just respond… it reflects.

---

## 🧬 Core Philosophy

Most AI systems are static.
MirrAI is not.

It is built on three principles:

- 🧠 **Memory** — Every interaction matters
- 🧬 **Evolution** — Personality is not fixed
- 🪞 **Reflection** — Responses should feel like _you_

Over time, MirrAI develops a unique identity shaped by its user.

---

## ⚙️ Key Features

### 🧠 Memory Engine

- Short-term memory (recent conversations)
- Long-term memory (vector embeddings)
- Semantic memory (facts about the user)
- Emotional memory (important emotional moments)

---

### 🧬 Personality Evolution

- Dynamic personality traits:
  - empathy
  - logic
  - humor
  - confidence
  - playfulness

- Traits evolve based on:
  - interaction patterns
  - emotional signals
  - feedback loops

---

### ❤️ Emotion Awareness

- Detects user emotion from text input
- Adjusts tone and response accordingly
- Stores emotional context for future interactions

---

### 💭 Thought Simulation

- Breaks down input into reasoning steps
- Mimics user decision-making patterns
- Learns from past responses and behavior

---

### 🧠 Digital Twin Mode

- Generates responses as if it were _you_
- Uses:
  - memory
  - personality
  - past decisions

---

### 🔄 Self-Evolution System

- Updates personality after each interaction
- Re-evaluates memory importance
- Continuously improves contextual understanding

---

## 🔁 System Flow

```
User Input
   ↓
Emotion Analysis
   ↓
Memory Retrieval
   ↓
Personality Load
   ↓
Thought Simulation
   ↓
Response Generation
   ↓
Memory Update
   ↓
Personality Evolution
```

---

## 🏗️ Architecture

```
Client (Web / Mobile)
   ↓
Express API
   ↓
LangChain Orchestrator
   ↓
Core Modules:
  - Memory Engine
  - Personality Engine
  - Emotion Engine
  - Thought Engine
  - Decision Engine
   ↓
LLM Provider (OpenAI / Gemini / Local)
   ↓
Database + Vector Store
```

---

## 🧩 Project Structure (Planned)

```
mirrai/
├── app/
│   ├── modules/
│   │   ├── chat/
│   │   ├── memory/
│   │   ├── personality/
│   │   ├── emotion/
│   │   └── decision/
│   ├── services/
│   ├── utils/
│   ├── middlewares/
│   └── llm/
│       ├── providers/
│       └── prompts/
├── config/
├── scripts/
├── tests/
└── server.js
```

---

## 🚀 Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/Reinvy/mirrai.git
cd mirrai
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Setup Environment Variables

Buat file `.env`:

```env
PORT=3000

# LLM
OPENAI_API_KEY=your_key_here

# Database
DATABASE_URL=your_database_url

# Vector DB
VECTOR_DB_URL=your_vector_db
```

---

### 4. Run Server

```bash
npm run dev
```

---

## 📡 API Example

### POST `/api/chat`

#### Request

```json
{
  "userId": "123",
  "message": "I feel really tired today"
}
```

#### Response

```json
{
  "response": "You’ve been pushing yourself a lot lately… maybe it’s okay to slow down a bit.",
  "emotion": {
    "type": "sad",
    "confidence": 0.82
  },
  "personality_snapshot": {
    "empathy": 0.78,
    "logic": 0.65
  }
}
```

---

## 🧠 Prompt Design (Dynamic)

MirrAI builds prompts dynamically using:

- personality state
- user emotion
- relevant memories

Example:

```txt
You are a digital twin of the user.

Personality:
- empathy: 0.78
- logic: 0.65

User Emotion:
- sad

Relevant Memories:
- user often works late
- user prefers calm reasoning

Respond as the user would think.
```

---

## 🗄️ Data Model (Simplified)

### Conversations

- user_id
- message
- response
- emotion
- created_at

---

### Memory

- content
- embedding
- type
- importance_score

---

### Personality

- empathy
- logic
- humor
- confidence
- playfulness

---

## 📈 Roadmap

### Phase 1 (MVP)

- Chat system
- Basic memory
- Emotion detection
- Static personality

---

### Phase 2

- Personality evolution
- Improved memory ranking
- Reflection mode

---

### Phase 3

- Proactive AI (initiates conversation)
- Voice interaction
- Multi-device sync

---

## ⚠️ Limitations

- Personality evolution is probabilistic
- Emotion detection may not always be accurate
- LLM responses may contain hallucinations

---

## 🔒 Privacy & Ethics

MirrAI handles deeply personal data.
Recommended practices:

- encrypt user data
- allow memory deletion
- transparent data usage

---

## 🤝 Contributing

Contributions are welcome.

You can help by:

- improving memory retrieval
- optimizing personality evolution
- enhancing prompt strategies

---

## 💛 Final Note

MirrAI is not just an AI assistant.

It is an attempt to build something that:

- understands
- remembers
- and slowly becomes… a reflection of you

> Not just intelligence — but identity.
