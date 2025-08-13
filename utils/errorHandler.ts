export interface AppError {
  code: string;
  message: string;
  details?: string;
  timestamp: Date;
  userId?: string;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errors: AppError[] = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  logError(error: Error | string, context?: string, userId?: string): AppError {
    const appError: AppError = {
      code: this.getErrorCode(error),
      message: typeof error === 'string' ? error : error.message,
      details: context,
      timestamp: new Date(),
      userId,
    };

    this.errors.push(appError);
    console.error('App Error:', appError);
    
    // In production, you'd send this to a logging service
    // this.sendToLoggingService(appError);
    
    return appError;
  }

  private getErrorCode(error: Error | string): string {
    if (typeof error === 'string') {
      return 'GENERIC_ERROR';
    }

    // Map common error types to codes
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('auth')) return 'AUTH_ERROR';
    if (error.message.includes('validation')) return 'VALIDATION_ERROR';
    if (error.message.includes('database')) return 'DATABASE_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  getRecentErrors(limit: number = 10): AppError[] {
    return this.errors.slice(-limit);
  }

  clearErrors(): void {
    this.errors = [];
  }

  getUserFriendlyMessage(error: AppError): string {
    const messages: Record<string, string> = {
      NETWORK_ERROR: 'Connection failed. Please check your internet connection.',
      AUTH_ERROR: 'Authentication failed. Please log in again.',
      VALIDATION_ERROR: 'Please check your input and try again.',
      DATABASE_ERROR: 'Data operation failed. Please try again.',
      GENERIC_ERROR: 'Something went wrong. Please try again.',
      UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
    };

    return messages[error.code] || messages.UNKNOWN_ERROR;
  }
}

export const errorHandler = ErrorHandler.getInstance(); 