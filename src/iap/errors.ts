export type IapErrorCode =
  | 'not_initialized'
  | 'store_unavailable'
  | 'product_not_found'
  | 'user_cancelled'
  | 'already_owned'
  | 'pending'
  | 'network'
  | 'validation_failed'
  | 'conflict'
  | 'unknown';

export interface IapErrorShape {
  code: IapErrorCode;
  message: string;
  cause?: unknown;
}

export class IapError extends Error {
  readonly code: IapErrorCode;
  readonly cause?: unknown;

  constructor(shape: IapErrorShape) {
    super(shape.message);
    this.name = 'IapError';
    this.code = shape.code;
    this.cause = shape.cause;
  }
}
