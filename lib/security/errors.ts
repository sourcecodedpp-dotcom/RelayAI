import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/**
 * Parses and formats backend errors into consistent JSON responses.
 */
export function handleApiError(error: any) {
  console.error("⚠️ API Route Exception Caught:", error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation Failure",
        message: "Invalid input parameters supplied.",
        details: error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (error.name === "UnauthorizedError" || error.status === 401) {
    return NextResponse.json(
      {
        error: "Unauthorized access denied",
        message: error.message || "You must authenticate before accessing this endpoint.",
      },
      { status: 401 }
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.name,
        message: error.message,
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "production" 
        ? "An unexpected error occurred." 
        : error.message || String(error),
    },
    { status: 500 }
  );
}
