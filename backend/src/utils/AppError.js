// ─────────────────────────────────────────────────────────────
// AppError — operational (expected) errors with an HTTP status.
// Thrown by controllers/services and formatted by errorMiddleware.
// ─────────────────────────────────────────────────────────────

class AppError extends Error {
  /**
   * @param {string} message    Human-readable message sent to the client
   * @param {number} statusCode HTTP status code (default 500)
   * @param {object} [details]  Optional extra info (e.g. field errors)
   */
  constructor(message, statusCode = 500, details = undefined) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;

    if (details !== undefined) {
      this.details = details;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request.', details) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = 'Authentication required.') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'You do not have permission to perform this action.') {
    return new AppError(message, 403);
  }

  static notFound(message = 'Resource not found.') {
    return new AppError(message, 404);
  }

  static conflict(message = 'Conflict.', details) {
    return new AppError(message, 409, details);
  }
}

export default AppError;