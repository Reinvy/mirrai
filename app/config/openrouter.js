'use strict'

const { ChatOpenRouter } = require('@langchain/openrouter')

const llm = new ChatOpenRouter({
  model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
  temperature: 0.7,
})

module.exports = { llm }
