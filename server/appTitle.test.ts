import { describe, expect, it } from "vitest";
import { computeAppTitle, PROD_APP_TITLE } from "../client/src/lib/appTitle";

describe("computeAppTitle (APP_ENV_LABEL Semantik, Vertrag mit NAS-Chat)", () => {
  it("gesetzt ⇒ 'ProTrackr (<LABEL>)'", () => {
    expect(computeAppTitle("DEV")).toBe("ProTrackr (DEV)");
    expect(computeAppTitle("STAGING")).toBe("ProTrackr (STAGING)");
  });

  it("leer/unset/whitespace ⇒ Prod-Titel", () => {
    expect(computeAppTitle(undefined)).toBe(PROD_APP_TITLE);
    expect(computeAppTitle(null)).toBe(PROD_APP_TITLE);
    expect(computeAppTitle("")).toBe(PROD_APP_TITLE);
    expect(computeAppTitle("   ")).toBe(PROD_APP_TITLE);
  });

  it("trimmt gesetzte Labels", () => {
    expect(computeAppTitle("  DEV  ")).toBe("ProTrackr (DEV)");
  });

  it("Prod-Titel ist exakt der Vertrags-String", () => {
    expect(PROD_APP_TITLE).toBe("Döring Consulting - Projekt & Abrechnungsmanagement");
  });
});
