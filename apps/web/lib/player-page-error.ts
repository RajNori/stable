import { playerMessages } from "@stable/players";

const ROW_LIST = /^(?:[1-9]|[1-4]\d|50)(?:,(?:[1-9]|[1-4]\d|50))*$/u;

const ALLOWED_ERRORS: readonly string[] = Object.values(playerMessages);

export function playerPageError(
  errorValue: string | string[] | undefined,
  rowsValue: string | string[] | undefined,
): string | undefined {
  const error = first(errorValue);
  if (error === undefined || !ALLOWED_ERRORS.includes(error)) {
    return undefined;
  }

  if (error !== playerMessages.importValidationFailed) {
    return error;
  }

  const rows = rowNumbers(first(rowsValue));
  if (rows.length === 0) {
    return error;
  }

  return `${error} ${rows.map((row) => `Check row ${row}.`).join(" ")}`;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function rowNumbers(value: string | undefined): number[] {
  if (value === undefined || !ROW_LIST.test(value)) {
    return [];
  }
  return value.split(",").map((part) => Number(part));
}
