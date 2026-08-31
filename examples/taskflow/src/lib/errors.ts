// Domain error types. Each carries an HTTP status so the router layer can map
// thrown errors to responses without knowing the specifics of each service.

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`, 404, "not_found");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422, "validation_failed");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "authentication required") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "operation not permitted") {
    super(message, 403, "forbidden");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "conflict");
  }
}
