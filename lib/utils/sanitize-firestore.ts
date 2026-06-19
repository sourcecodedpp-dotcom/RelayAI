/**
 * Sanitizes a payload recursively to remove all undefined values.
 * - Removes undefined values from nested objects.
 * - Removes undefined values from arrays.
 * - Preserves null values.
 * - Preserves false, 0, and empty strings.
 * - Preserves special classes (e.g., Dates, Firestore FieldValues).
 */
export function sanitizeFirestore<T>(data: T): T {
  if (data === undefined) {
    return undefined as unknown as T;
  }
  
  if (data === null) {
    return null as unknown as T;
  }

  if (Array.isArray(data)) {
    return data
      .map(item => sanitizeFirestore(item))
      .filter(item => item !== undefined) as unknown as T;
  }

  if (typeof data === "object") {
    // Handle standard Dates
    if (data instanceof Date) {
      return data;
    }

    // Preserve special Firestore objects or other class instances
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) {
      return data;
    }

    const sanitizedObj: Record<string, any> = {};
    for (const key of Object.keys(data as Record<string, any>)) {
      const val = (data as Record<string, any>)[key];
      const sanitizedVal = sanitizeFirestore(val);
      if (sanitizedVal !== undefined) {
        sanitizedObj[key] = sanitizedVal;
      }
    }
    return sanitizedObj as unknown as T;
  }

  return data;
}
