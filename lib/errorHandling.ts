// Centraliserad felhantering
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware för API-felhantering
export const apiErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Något gick fel';

  // Logga felet (kan integreras med Sentry eller liknande)
  console.error(`ERROR 💥: ${err.message}`);
  
  // Skicka olika svar beroende på miljö
  if (process.env.NODE_ENV === 'production') {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: 'error',
        message: err.message
      });
    }
    // För programmeringsfel, skicka generiskt meddelande
    return res.status(500).json({
      status: 'error',
      message: 'Något gick fel'
    });
  }
  
  // I utvecklingsmiljö, skicka detaljerad felinformation
  return res.status(err.statusCode).json({
    status: 'error',
    message: err.message,
    stack: err.stack,
    error: err
  });
}; 