import { auth } from "./auth-config";

class UnauthorizedError extends Error {
  status = 401;
  constructor(message = "Unauthorized: Please log in to continue.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Returns the authenticated tenant's user ID from the session.
 * Throws a 401 UnauthorizedError if the session is invalid or missing.
 */
export async function getAuthenticatedUserOrThrow(): Promise<string> {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }
  
  return session.user.id;
}
