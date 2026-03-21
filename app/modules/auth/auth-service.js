'use strict'

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { prisma } = require('../../config/db')
const { AppError } = require('../../utils/app-error')

const SALT_ROUNDS = 12

async function register(name, password) {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      password: hashedPassword,
      personality: {
        create: {
          empathy: 0.5,
          logic: 0.5,
          humor: 0.5,
          confidence: 0.5,
          playfulness: 0.5,
        },
      },
    },
    select: { id: true, name: true, createdAt: true },
  })

  return user
}

async function login(name, password) {
  const user = await prisma.user.findFirst({
    where: { name: name.trim(), deletedAt: null },
  })

  if (!user) {
    throw new AppError(401, 'Nama atau password salah')
  }

  const passwordMatch = await bcrypt.compare(password, user.password)
  if (!passwordMatch) {
    throw new AppError(401, 'Nama atau password salah')
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION ?? '8h' }
  )

  return { token, user: { id: user.id, name: user.name } }
}

async function logout(token) {
  await prisma.tokenBlacklist.create({ data: { token } })
}

module.exports = { register, login, logout }
