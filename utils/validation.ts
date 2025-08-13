export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class Validator {
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];
    
    if (!email) {
      errors.push('Email is required');
      return { isValid: false, errors };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      errors.push('Please enter a valid email address');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validatePassword(password: string): ValidationResult {
    const errors: string[] = [];
    
    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateRequired(value: any, fieldName: string): ValidationResult {
    const errors: string[] = [];
    
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors.push(`${fieldName} is required`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateLength(value: string, fieldName: string, min?: number, max?: number): ValidationResult {
    const errors: string[] = [];
    
    if (min && value.length < min) {
      errors.push(`${fieldName} must be at least ${min} characters long`);
    }

    if (max && value.length > max) {
      errors.push(`${fieldName} must be no more than ${max} characters long`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateNumber(value: any, fieldName: string, min?: number, max?: number): ValidationResult {
    const errors: string[] = [];
    
    const numValue = Number(value);
    if (isNaN(numValue)) {
      errors.push(`${fieldName} must be a valid number`);
      return { isValid: false, errors };
    }

    if (min !== undefined && numValue < min) {
      errors.push(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && numValue > max) {
      errors.push(`${fieldName} must be no more than ${max}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateDate(date: string | Date, fieldName: string): ValidationResult {
    const errors: string[] = [];
    
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      errors.push(`${fieldName} must be a valid date`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateBatchData(data: any): ValidationResult {
    const errors: string[] = [];
    
    // Validate required fields
    const requiredFields = ['species', 'location', 'quantity'];
    requiredFields.forEach(field => {
      const result = this.validateRequired(data[field], field);
      errors.push(...result.errors);
    });

    // Validate quantity
    if (data.quantity) {
      const quantityResult = this.validateNumber(data.quantity, 'Quantity', 1);
      errors.push(...quantityResult.errors);
    }

    // Validate date
    if (data.startDate) {
      const dateResult = this.validateDate(data.startDate, 'Start Date');
      errors.push(...dateResult.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateHarvestData(data: any): ValidationResult {
    const errors: string[] = [];
    
    // Validate required fields
    const requiredFields = ['batchId', 'quantity', 'quality'];
    requiredFields.forEach(field => {
      const result = this.validateRequired(data[field], field);
      errors.push(...result.errors);
    });

    // Validate quantity
    if (data.quantity) {
      const quantityResult = this.validateNumber(data.quantity, 'Quantity', 0);
      errors.push(...quantityResult.errors);
    }

    // Validate quality grade
    if (data.quality && !['A', 'B', 'C', 'D'].includes(data.quality)) {
      errors.push('Quality grade must be A, B, C, or D');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
} 