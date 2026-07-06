import { afterEach, describe, expect, it } from "vitest";
import { getAppEnvLabel, injectAppEnvLabel } from "./_core/envLabel";

describe("envLabel (APP_ENV_LABEL Runtime-Injektion)", () => {
  const original = process.env.APP_ENV_LABEL;
  afterEach(() => {
    if (original === undefined) delete process.env.APP_ENV_LABEL;
    else process.env.APP_ENV_LABEL = original;
  });

  it("getAppEnvLabel: '' bei unset, getrimmt bei gesetzt", () => {
    delete process.env.APP_ENV_LABEL;
    expect(getAppEnvLabel()).toBe("");
    process.env.APP_ENV_LABEL = "  DEV  ";
    expect(getAppEnvLabel()).toBe("DEV");
  });

  it("injiziert window.__APP_ENV_LABEL__ mit dem Label vor </head>", () => {
    const out = injectAppEnvLabel("<head><title>x</title></head><body></body>", "DEV");
    expect(out).toContain('<script>window.__APP_ENV_LABEL__="DEV";</script></head>');
    // vor </head> ⇒ synchron vor dem Module-Script (kein Titel-Flash)
    expect(out.indexOf("__APP_ENV_LABEL__")).toBeLessThan(out.indexOf("</head>"));
  });

  it("injiziert leeren String bei unset (Client fällt auf Prod-Titel)", () => {
    delete process.env.APP_ENV_LABEL;
    const out = injectAppEnvLabel("<head></head>");
    expect(out).toContain('window.__APP_ENV_LABEL__="";');
  });

  it("escaped '<' → verhindert </script>-Breakout", () => {
    const out = injectAppEnvLabel("<head></head>", "</script>");
    expect(out).not.toContain("</script></script>");
    expect(out).toContain("\\u003c");
  });

  it("fügt das Script auch ohne </head> ein (Fallback)", () => {
    const out = injectAppEnvLabel("<body>x</body>", "DEV");
    expect(out.startsWith('<script>window.__APP_ENV_LABEL__="DEV";</script>')).toBe(true);
  });
});
