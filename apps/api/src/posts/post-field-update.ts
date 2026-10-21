/**
 * Значення поля поста після запиту — як його розуміють `POST` / `PUT /posts` (D44, D26): передане
 * (і `null` — прибрати) — з запиту, не передане — наявне; у нового поста наявного немає.
 */
export function requestedOrCurrent(
  requestedValue: string | null | undefined,
  currentValue: string | null | undefined,
): string | null {
  return requestedValue === undefined ? (currentValue ?? null) : requestedValue;
}
