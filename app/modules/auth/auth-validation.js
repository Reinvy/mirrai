'use strict'

const { AppError } = require('../../utils/app-error')

class AuthValidation {
  static validateRegister(req, res, next) {
    const { name, password } = req.body
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new AppError(400, 'Nama harus diisi minimal 2 karakter')
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new AppError(400, 'Password harus diisi minimal 6 karakter')
    }
    next()
  }

  static validateLogin(req, res, next) {
    const { name, password } = req.body
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError(400, 'Nama harus diisi')
    }
    if (!password || typeof password !== 'string' || password.length === 0) {
      throw new AppError(400, 'Password harus diisi')
    }
    next()
  }
}

module.exports = { AuthValidation }
