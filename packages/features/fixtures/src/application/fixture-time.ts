import { ApplicationError } from "@stable/contracts";

import { fixtureMessages } from "./fixture-messages.js";

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function invalidTime(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    fixtureMessages.validationFailed,
  );
}

function part(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const value = parts.find((item) => item.type === type)?.value;
  if (value === undefined) {
    invalidTime();
  }
  return value === "24" ? "00" : value;
}

function zoneParts(utcMs: number, timeZone: string): Intl.DateTimeFormatPart[] {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
  } catch {
    invalidTime();
  }
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = zoneParts(utcMs, timeZone);
  const asUtc = Date.UTC(
    Number(part(parts, "year")),
    Number(part(parts, "month")) - 1,
    Number(part(parts, "day")),
    Number(part(parts, "hour")),
    Number(part(parts, "minute")),
    Number(part(parts, "second")),
  );
  if (Number.isNaN(asUtc)) {
    invalidTime();
  }
  return asUtc - utcMs;
}

export function localDateTimeToUtcIso(
  localDateTime: string,
  timeZone: string,
): string {
  const match = LOCAL_DATE_TIME.exec(localDateTime);
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];
  const hourText = match?.[4];
  const minuteText = match?.[5];
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined ||
    hourText === undefined ||
    minuteText === undefined
  ) {
    invalidTime();
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    invalidTime();
  }

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const adjusted = utcGuess - zoneOffsetMs(utcGuess, timeZone);
  const instant = utcGuess - zoneOffsetMs(adjusted, timeZone);
  const local = zoneParts(instant, timeZone);
  if (
    part(local, "year") !== yearText ||
    part(local, "month") !== monthText ||
    part(local, "day") !== dayText ||
    part(local, "hour") !== hourText ||
    part(local, "minute") !== minuteText
  ) {
    invalidTime();
  }
  return new Date(instant).toISOString();
}

export function utcIsoToLocalDateTime(iso: string, timeZone: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    invalidTime();
  }
  const parts = zoneParts(instant.getTime(), timeZone);
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}T${part(parts, "hour")}:${part(parts, "minute")}`;
}
