import { z } from 'zod';
import Project from '../models/Project.js';
import Part from '../models/Part.js';
import { resourceRouter } from './resource.js';
import { HttpError } from '../middleware/errors.js';

const projectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().max(1000).default('')
});

export const projectsRouter = resourceRouter(Project, { schema: projectSchema, sort: { updatedAt: -1 } });

// Parts of one project, in a stable order (for "7 of 8" navigation on the part page).
projectsRouter.get('/:id/parts', async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id }).setOptions({ orgId: req.orgId });
    if (!project) throw new HttpError(404, 'Project not found');
    const parts = await Part.find({ projectId: project._id }).sort({ createdAt: 1 }).setOptions({ orgId: req.orgId });
    res.json({ project, parts });
  } catch (e) { next(e); }
});
