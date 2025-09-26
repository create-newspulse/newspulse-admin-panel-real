import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) { // eslint-disable-line
  const status = err.statusCode || 500;
  const payload = {
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      ...(err.details && { details: err.details }),
    },
  };
  if (status >= 500) logger.error(err);
  res.status(status).json(payload);
}
