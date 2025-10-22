export function readHeader(request: Request, name: string): string | null {
  const normalized = name.toLowerCase();
  for (const [key, value] of request.headers) {
    if (key.toLowerCase() === normalized) {
      return value;
    }
  }
  return null;
}

export function requireHeader(request: Request, name: string): string {
  const value = readHeader(request, name);
  if (!value || value.trim().length === 0) {
    throw new Error(`Header ${name} is required`);
  }
  return value;
}
