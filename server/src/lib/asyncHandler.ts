import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not forward a rejected promise from an async handler to the error
 * middleware - an unhandled rejection would otherwise crash the process. Wrap every
 * async route handler and async middleware with this.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
