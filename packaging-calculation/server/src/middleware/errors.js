import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// 402 = the customer's plan does not include this. The client shows an upgrade prompt.
export class PlanLimitError extends HttpError {
  constructor(message, extra = {}) {
    super(402, message, { upgrade: true, ...extra });
  }
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Please check the highlighted fields', fields: err.flatten().fieldErrors });
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'The file is too large' });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'A record with this name already exists' });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid id' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
