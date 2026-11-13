import {
  validateLogin,
  type LoginErrors,
  type LoginValues,
} from "./login-validation";

// Core-auth src/lib/auth.ts sets 12; Better Auth's unchanged maximum is 128.
// Keep these hints aligned with the service. Server validation remains authoritative.
export const registrationPasswordPolicy = {
  minLength: 12,
  maxLength: 128,
} as const;

export interface RegisterValues extends LoginValues {
  name: string;
  confirmPassword: string;
}

export interface RegisterErrors extends LoginErrors {
  name?: string;
  confirmPassword?: string;
}

export function validateRegistration(values: RegisterValues): RegisterErrors {
  const errors: RegisterErrors = { ...validateLogin(values) };
  if (!values.name.trim()) errors.name = "Enter your name.";
  if (
    values.password &&
    values.password.length < registrationPasswordPolicy.minLength
  ) {
    errors.password = `Use at least ${registrationPasswordPolicy.minLength} characters.`;
  } else if (values.password.length > registrationPasswordPolicy.maxLength) {
    errors.password = `Use no more than ${registrationPasswordPolicy.maxLength} characters.`;
  }
  if (!values.confirmPassword)
    errors.confirmPassword = "Confirm your password.";
  else if (values.password !== values.confirmPassword)
    errors.confirmPassword = "Passwords don't match.";
  return errors;
}

export function signUpErrorMessage(error: {
  code?: string;
  status?: number;
}): string {
  switch (error.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Try signing in instead.";
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
    case "INVALID_PASSWORD":
      return "This password doesn't meet the service's requirements. Choose a different password.";
    case "INVALID_EMAIL":
    case "VALIDATION_ERROR":
      return "Check your details and try again.";
    case "SIGN_UP_DISABLED":
      return "Registration isn't available right now. Please try again later.";
    case "EMAIL_NOT_VERIFIED":
      return "Email verification is required. Complete that step before signing in.";
  }
  if (error.status === 429)
    return "Too many attempts. Please wait a moment and try again.";
  if (error.status === 400 || error.status === 422)
    return "We couldn't register these details. Check them and try again.";
  if (error.status === 403)
    return "Registration isn't available right now. Please contact your service administrator.";
  return "Registration is temporarily unavailable. Please try again in a moment.";
}
