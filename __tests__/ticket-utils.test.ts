import { regexRedact, rerank, checkGrounding } from "../lib/ticket-utils";

describe("ticket-utils", () => {
  describe("regexRedact", () => {
    it("should redact IP addresses", () => {
      expect(regexRedact("User IP is 192.168.1.1")).toBe("User IP is [REDACTED_IP]");
    });

    it("should redact emails", () => {
      expect(regexRedact("Contact me at user@example.com")).toBe("Contact me at [REDACTED_EMAIL]");
    });

    it("should redact phone numbers", () => {
      expect(regexRedact("Call 555-123-4567 for help")).toBe("Call [REDACTED_PHONE] for help");
    });

    it("should redact SSNs", () => {
      expect(regexRedact("My SSN is 123-45-6789")).toBe("My SSN is [REDACTED_SSN]");
    });

    it("should redact multiple fields", () => {
      expect(regexRedact("IP: 10.0.0.1, Email: test@test.com")).toBe("IP: [REDACTED_IP], Email: [REDACTED_EMAIL]");
    });
  });

  describe("rerank", () => {
    const docs = [
      { id: 1, sanitized_query: "Network issue with VPN", similarity: 0.5 },
      { id: 2, sanitized_query: "Database connection failed", similarity: 0.6 },
    ];

    it("should rerank based on original similarity and keyword overlap", () => {
      const query = "VPN network problem";
      const result = rerank(docs, query);
      
      // Doc 1 has "network" and "vpn", they both overlap.
      // Doc 2 has zero overlap. Doc 1 should be ranked higher despite lower initial similarity.
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(result[0].rerankScore).toBeGreaterThan(result[1].rerankScore);
    });
  });

  describe("checkGrounding", () => {
    it("should return ungrounded for empty context", () => {
      const result = checkGrounding("Some resolution", "");
      expect(result.isGrounded).toBe(false);
      expect(result.groundingScore).toBe(0);
    });

    it("should return grounded when there is sufficient token overlap", () => {
      const context = "User reported vpn issue. resolution: reboot router and check connection.";
      const resolution = "To fix the vpn issue, you should reboot the router directly.";
      const result = checkGrounding(resolution, context);
      
      expect(result.isGrounded).toBe(true);
      expect(result.groundingScore).toBeGreaterThan(0.2); // Based on tokens > 3 chars
    });

    it("should return ungrounded when there is poor overlap", () => {
      const context = "User reported printer issue. Added paper and replaced toner.";
      const resolution = "Reboot the database server and check elasticsearch logs.";
      const result = checkGrounding(resolution, context);
      
      expect(result.isGrounded).toBe(false);
      expect(result.groundingScore).toBeLessThan(0.2);
    });
  });
});
