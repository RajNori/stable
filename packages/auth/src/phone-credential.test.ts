import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED } from "./identity-link-policy.js";
import { requestPhoneCredentialChange } from "./phone-credential.js";

const principal = {
  userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

describe("phone credential change", () => {
  it("stays unimplemented and has no provider argument", () => {
    expect(PHONE_CREDENTIAL_LINKING_IS_IMPLEMENTED).toBe(false);
    expect(requestPhoneCredentialChange.length).toBe(1);
  });

  it("fails closed for a normalized number", async () => {
    await expect(
      requestPhoneCredentialChange({
        principal,
        phone: "0400 000 000",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This sign-in method can't be added.",
    });
  });

  it("rejects a signed-out adult and a number that is not Australian", async () => {
    await expect(
      requestPhoneCredentialChange({
        principal: null,
        phone: "0400000000",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });
    await expect(
      requestPhoneCredentialChange({
        principal,
        phone: "+14155552671",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Enter an Australian mobile number.",
    });
  });

  it("does not call a provider phone update", () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const operation = readFileSync(
      join(directory, "phone-credential.ts"),
      "utf8",
    );
    const barrel = readFileSync(join(directory, "index.ts"), "utf8");
    expect(operation.includes("updateUser")).toBe(false);
    expect(barrel.includes("updateUser")).toBe(false);
  });
});
