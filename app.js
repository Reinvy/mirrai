'use strict'

require('dotenv').config()

const express = require('express')
const path = require('path')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')

const { swaggerSpec } = require('./app/config/openapi')
const { apiReference } = require('@scalar/express-api-reference')
const { errorHandler } = require('./app/middlewares/error-handler')
const { AppError } = require('./app/utils/app-error')

// Module routers (imported lazily; will exist after Phase 2+)
let authRouter, memoryRouter, personalityRouter, chatRouter
try { authRouter = require('./app/modules/auth/auth-router') } catch {}
try { memoryRouter = require('./app/modules/memory/memory-router') } catch {}
try { personalityRouter = require('./app/modules/personality/personality-router') } catch {}
try { chatRouter = require('./app/modules/chat/chat-router') } catch {}

const app = express()

// Security & CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',')
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))
app.use(helmet())

// Logging & parsing
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// API routes
if (authRouter) app.use('/api/auth', authRouter)
if (memoryRouter) app.use('/api/memory', memoryRouter)
if (personalityRouter) app.use('/api/personality', personalityRouter)
if (chatRouter) app.use('/api/chat', chatRouter)

// API docs
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec))
app.use('/docs', apiReference({ spec: { url: '/api-docs.json' } }))

// 404 handler
app.use((req, res, next) => {
  next(new AppError(404, `Route ${req.method} ${req.path} tidak ditemukan`))
})

// Global error handler (must be last)
app.use(errorHandler)

module.exports = app

