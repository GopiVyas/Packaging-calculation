import { Router } from 'express'
import Company from '../models/Company.js'

const router = Router()

router.post('/', async (request, response, next) => {
  try {
    const { companyName, email, phone } = request.body

    if (!companyName || !email || !phone) {
      return response.status(400).json({ error: 'Company name, email, and phone are required.' })
    }

    const company = await Company.create({ companyName, email, phone })
    return response.status(201).json({ message: 'Registration successful.', company })
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'This email is already registered.' })
    return next(error)
  }
})

export default router
