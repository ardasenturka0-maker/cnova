export class RequestBodyError extends Error {
  constructor(message: string, readonly status: 400 | 413 | 415) {
    super(message);
    this.name = "RequestBodyError";
  }
}

function declaredLength(request: Request) {
  const raw = request.headers.get("content-length");
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) throw new RequestBodyError("İstek gövdesi uzunluğu geçersiz.", 400);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new RequestBodyError("İstek gövdesi uzunluğu geçersiz.", 400);
  return value;
}

export async function readRequestBody(request: Request, maximumBytes: number) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) throw new Error("Geçersiz istek gövdesi sınırı.");
  const length = declaredLength(request);
  if (length !== null && length > maximumBytes) throw new RequestBodyError("İstek gövdesi izin verilen boyutu aşıyor.", 413);
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyError("İstek gövdesi izin verilen boyutu aşıyor.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJsonBody(request: Request, maximumBytes = 64 * 1024): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType && contentType !== "application/json" && !contentType.endsWith("+json")) {
    throw new RequestBodyError("İstek gövdesi JSON biçiminde olmalı.", 415);
  }
  const bytes = await readRequestBody(request, maximumBytes);
  if (bytes.byteLength === 0) throw new RequestBodyError("İstek gövdesi boş olamaz.", 400);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new RequestBodyError("İstek gövdesi geçerli JSON değil.", 400);
  }
}

export async function readFormDataBody(request: Request, maximumBytes: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("multipart/form-data;")) {
    throw new RequestBodyError("İstek gövdesi multipart form biçiminde olmalı.", 415);
  }
  const bytes = await readRequestBody(request, maximumBytes);
  const headers = new Headers(request.headers);
  headers.set("content-length", String(bytes.byteLength));
  try {
    return await new Request(request.url, { method: "POST", headers, body: bytes }).formData();
  } catch {
    throw new RequestBodyError("Form verisi okunamadı.", 400);
  }
}

export function requestBodyErrorResponse(error: unknown) {
  if (!(error instanceof RequestBodyError)) return null;
  return Response.json(
    { error: error.message },
    { status: error.status, headers: { "Cache-Control": "no-store" } }
  );
}
