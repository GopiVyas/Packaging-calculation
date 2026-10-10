import { Router } from 'express'

export function createCrudRouter(Model) {
  const router = Router()
  router.get('/', async (_request, response, next) => { try { response.json(await Model.find().sort({ createdAt: -1 })) } catch (error) { next(error) } })
  router.post('/', async (request, response, next) => { try { response.status(201).json(await Model.create(request.body)) } catch (error) { next(error) } })
  router.get('/:id', async (request, response, next) => { try { response.json(await Model.findById(request.params.id)) } catch (error) { next(error) } })
  router.delete('/:id', async (request, response, next) => { try { await Model.findByIdAndDelete(request.params.id); response.status(204).end() } catch (error) { next(error) } })
  return router
}