import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  const status = err.status || 500;
  const message = err.message || 'Внутренняя ошибка сервера';

  // Do not expose stack traces in production
  const responsePayload: any = {
    error: message,
    code: err.code || (status === 400 ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR')
  };

  if (err.validationErrors) {
    responsePayload.validationErrors = err.validationErrors;
  }

  if (process.env.NODE_ENV !== 'production' && status === 500) {
    responsePayload.stack = err.stack;
  }

  res.status(status).json(responsePayload);
}
