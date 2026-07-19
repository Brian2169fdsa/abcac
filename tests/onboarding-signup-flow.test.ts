import { describe, expect, it } from "vitest";
import { parseSubmittedCerts } from "@/components/onboarding-flow";
import { certNumberTokens } from "@/lib/automation/workflows/account-approval";
import { requestOrigin } from "@/lib/request-origin";

describe("onboarding self-reported certifications", () => {
  it("round-trips the submitted_cert_numbers format the admin side reads", () => {
    // What the fixed onboarding form writes...
    const written = "CAC 12345, CADAC 9876";
    // ...parses back into editable rows for the member...
    expect(parseSubmittedCerts(written)).toEqual([
      { cert_type: "CAC", cert_number: "12345" },
      { cert_type: "CADAC", cert_number: "9876" },
    ]);
    // ...and tokenizes for the admin approval automation.
    expect(certNumberTokens(written)).toEqual(["CAC 12345", "CADAC 9876"]);
  });

  it("keeps free-text numbers without a recognized credential prefix", () => {
    expect(parseSubmittedCerts("4471")).toEqual([{ cert_type: "", cert_number: "4471" }]);
  });

  it("returns one empty row for blank input", () => {
    expect(parseSubmittedCerts(null)).toEqual([{ cert_type: "", cert_number: "" }]);
    expect(parseSubmittedCerts("  ")).toEqual([{ cert_type: "", cert_number: "" }]);
  });
});

describe("requestOrigin", () => {
  it("prefers x-forwarded-host so redirects stay on the serving deployment", () => {
    const req = new Request("http://internal/api/stripe/checkout", {
      headers: { "x-forwarded-host": "abcac.vercel.app", "x-forwarded-proto": "https", host: "internal" },
    });
    expect(requestOrigin(req)).toBe("https://abcac.vercel.app");
  });

  it("falls back to the host header, then the env default", () => {
    expect(requestOrigin(new Request("http://x/", { headers: { host: "localhost:3000", "x-forwarded-proto": "http" } }))).toBe("http://localhost:3000");
  });

  it("uses only the first value of comma-joined forwarded headers", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-host": "abcac.org, proxy.internal", "x-forwarded-proto": "https,http" },
    });
    expect(requestOrigin(req)).toBe("https://abcac.org");
  });
});
