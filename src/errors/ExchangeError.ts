export class ExchangeError extends Error {
    
    code: number;
    
    constructor(message, code) {
      super(message); 
      this.name = this.constructor.name;
      this.code = code; 
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  