'use strict'

const swaggerJsdoc = require('swagger-jsdoc')
const path = require('path')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MirrAI API',
      version: '1.0.0',
      description: 'MirrAI — AI companion with memory, personality & emotion engines',
    },
    servers: [{ url: '/api', description: 'API base' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        Personality: {
          type: 'object',
          properties: {
            empathy: { type: 'number', minimum: 0, maximum: 1 },
            logic: { type: 'number', minimum: 0, maximum: 1 },
            humor: { type: 'number', minimum: 0, maximum: 1 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            playfulness: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
        Memory: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string', enum: ['SHORT_TERM', 'LONG_TERM', 'SEMANTIC', 'EMOTIONAL'] },
            importanceScore: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ChatResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                response: { type: 'string' },
                emotion: {
                  type: 'object',
                  properties: {
                    emotion: { type: 'string' },
                    confidence: { type: 'number' },
                  },
                },
                personality_snapshot: { $ref: '#/components/schemas/Personality' },
              },
            },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, '../modules/**/*-router.js')],
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = { swaggerSpec }
