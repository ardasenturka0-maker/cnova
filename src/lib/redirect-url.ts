export function redirectWithMessage(path: string, key: "success" | "error", message: string) {
  const query = new URLSearchParams({ [key]: message });
  return `${path}?${query.toString()}`;
}
