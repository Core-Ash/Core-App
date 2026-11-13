export interface LoginValues {
  email: string;
  password: string;
}
export interface LoginErrors {
  email?: string;
  password?: string;
}

export function validateLogin({ email, password }: LoginValues): LoginErrors {
  const errors: LoginErrors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errors.email = "Enter a valid email address.";
  // Existing accounts may have different password policies. Only the service validates credentials.
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export function signInErrorMessage(error: {
  status?: number;
  code?: string;
}): string {
  if (error.status === 429)
    return "Too many sign-in attempts. Please wait a moment and try again.";
  if (error.code === "EMAIL_NOT_VERIFIED")
    return "Please verify your email before signing in. Check your inbox for the verification email.";
  if (error.status === 400 || error.status === 401)
    return "We couldn't sign you in. Check your email and password and try again.";
  if (error.status === 403)
    return "Sign-in isn't available for this account. Please contact your service administrator.";
  return "Sign-in is temporarily unavailable. Please try again in a moment.";
}
