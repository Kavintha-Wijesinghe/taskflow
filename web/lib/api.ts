const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const body = options.body;

  const isJsonBody =
    body !== null &&
    body !== undefined &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof URLSearchParams) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer);

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isJsonBody
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
    body: isJsonBody
      ? JSON.stringify(body)
      : (body as BodyInit | null | undefined),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data as T;
}