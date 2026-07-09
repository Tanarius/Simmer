/**
 * Unit tests for isPrivateAddress — the resolved-IP classifier used by the SSRF guard on
 * GET /api/proxy/og-image (and reusable elsewhere). Pure function, no mocks.
 */

import { describe, it, expect } from "vitest";
import { isPrivateAddress } from "../middleware/requireAuth";

describe("isPrivateAddress — internal ranges are rejected", () => {
  it.each([
    ["127.0.0.1", "IPv4 loopback"],
    ["127.9.9.9", "IPv4 loopback /8"],
    ["10.0.0.1", "private 10/8"],
    ["10.255.255.255", "private 10/8 upper"],
    ["172.16.0.1", "private 172.16/12 lower"],
    ["172.31.255.255", "private 172.16/12 upper"],
    ["192.168.1.1", "private 192.168/16"],
    ["169.254.169.254", "link-local / cloud metadata"],
    ["0.0.0.0", "unspecified"],
    ["::1", "IPv6 loopback"],
    ["::", "IPv6 unspecified"],
    ["fe80::1", "IPv6 link-local"],
    ["fc00::1", "IPv6 ULA (fc)"],
    ["fd12:3456::1", "IPv6 ULA (fd)"],
    ["::ffff:127.0.0.1", "IPv4-mapped loopback"],
    ["::ffff:10.0.0.5", "IPv4-mapped private"],
  ])("rejects %s (%s)", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });
});

describe("isPrivateAddress — public addresses are allowed", () => {
  it.each([
    ["8.8.8.8", "Google DNS"],
    ["1.1.1.1", "Cloudflare DNS"],
    ["93.184.216.34", "example.com"],
    ["172.15.0.1", "just below 172.16/12"],
    ["172.32.0.1", "just above 172.16/12"],
    ["192.169.0.1", "not 192.168"],
    ["169.253.0.1", "not 169.254"],
    ["2606:4700:4700::1111", "Cloudflare IPv6"],
    ["2001:4860:4860::8888", "Google IPv6"],
  ])("allows %s (%s)", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it("treats a malformed dotted-quad as unsafe", () => {
    expect(isPrivateAddress("999.999.999.999")).toBe(true);
  });
});
