"use strict";

require("./setup");

jest.mock("dns", () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

const dns = require("dns");
const {
  assertSafeByokBaseUrl,
  __clearUrlSafetyCache,
} = require("../app/utils/url-safety");

function resolveTo(...addresses) {
  dns.promises.lookup.mockResolvedValue(
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    })),
  );
}

describe("BYOK baseUrl safety", () => {
  beforeEach(() => {
    __clearUrlSafetyCache();
    dns.promises.lookup.mockReset();
    delete process.env.BYOK_ALLOW_PRIVATE_HOSTS;
  });

  afterAll(() => {
    delete process.env.BYOK_ALLOW_PRIVATE_HOSTS;
  });

  it("rejects loopback, link-local, metadata, and private literals by default", async () => {
    const blocked = [
      "http://127.0.0.1:11434/v1",
      "http://10.0.0.5/v1",
      "http://192.168.1.5:11434",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]:11434",
      "http://[fd00:ec2::254]/",
      "http://100.100.100.200/",
    ];
    for (const url of blocked) {
      await expect(assertSafeByokBaseUrl(url)).rejects.toThrow(/tidak diizinkan/);
    }
  });

  it("rejects hostnames that resolve to a private address", async () => {
    resolveTo("127.0.0.1");
    await expect(assertSafeByokBaseUrl("https://internal.example.com/v1")).rejects.toThrow(
      /host privat\/loopback/,
    );
  });

  it("rejects private hostnames when an IPv6 answer is unique-local", async () => {
    resolveTo("93.184.216.34", "fd00:aa:bb:2050::1");
    await expect(assertSafeByokBaseUrl("https://mixed.example.com/v1")).rejects.toThrow(
      /host privat\/loopback/,
    );
  });

  it("accepts a public https endpoint", async () => {
    resolveTo("93.184.216.34");
    await expect(assertSafeByokBaseUrl("https://api.openai.com/v1")).resolves.toBe(
      "https://api.openai.com/v1",
    );
  });

  it("rejects non-http protocols and embedded credentials", async () => {
    await expect(assertSafeByokBaseUrl("ftp://example.com")).rejects.toThrow(/http/);
    await expect(
      assertSafeByokBaseUrl("https://user:pass@example.com/v1"),
    ).rejects.toThrow(/kredensial/);
  });

  it("rejects unresolvable hosts", async () => {
    dns.promises.lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertSafeByokBaseUrl("https://nope.invalid/v1")).rejects.toThrow(
      /tidak dapat di-resolve/,
    );
  });

  it("allows loopback and private hosts when explicitly opted in", async () => {
    process.env.BYOK_ALLOW_PRIVATE_HOSTS = "true";
    __clearUrlSafetyCache();

    await expect(assertSafeByokBaseUrl("http://127.0.0.1:11434")).resolves.toBe(
      "http://127.0.0.1:11434",
    );
    await expect(assertSafeByokBaseUrl("http://192.168.1.5:11434")).resolves.toBe(
      "http://192.168.1.5:11434",
    );
  });

  it("still blocks cloud metadata endpoints when private hosts are allowed", async () => {
    process.env.BYOK_ALLOW_PRIVATE_HOSTS = "true";
    __clearUrlSafetyCache();

    await expect(assertSafeByokBaseUrl("http://169.254.169.254/")).rejects.toThrow(
      /metadata/,
    );
    await expect(assertSafeByokBaseUrl("http://[fd00:ec2::254]/")).rejects.toThrow(
      /metadata/,
    );
  });

  it("caches successful resolutions for repeated calls", async () => {
    resolveTo("93.184.216.34");
    await assertSafeByokBaseUrl("https://cache.example.com/v1");
    await assertSafeByokBaseUrl("https://cache.example.com/v1");
    expect(dns.promises.lookup).toHaveBeenCalledTimes(1);
  });
});
