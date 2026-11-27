export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

function messageFrom(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "message" in body) {
    const { message } = body as { message: unknown }
    if (typeof message === "string") return message
    if (Array.isArray(message) && typeof message[0] === "string")
      return message[0]
  }
  return fallback
}

/** Same-origin JSON fetch. Non-2xx responses throw an ApiError. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set("Content-Type", "application/json")
  headers.set("Accept", "application/json")

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  })
  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : undefined
  if (!response.ok) {
    throw new ApiError(
      response.status,
      messageFrom(body, `Request failed with status ${response.status}`),
      body
    )
  }
  return body as T
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong"
}
