"use strict";

const dns = require("dns");
const net = require("net");
const { AppError } = require("./app-error");

const CACHE_TTL_MS = 60 * 1000;

// hostname -> { allowed: boolean, expiresAt: number }
const resolutionCache = new Map();

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain"]);

function isPrivateIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this host"
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function expandIPv6(ip) {
  const withoutZone = ip.split("%")[0];
  const [head, tail] = withoutZone.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail !== undefined && tail !== "" ? tail.split(":") : [];
  const fill = 8 - headParts.length - tailParts.length;
  if (tail === undefined) {
    return headParts;
  }
  return [...headParts, ...Array(Math.max(fill, 0)).fill("0"), ...tailParts];
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;

  const groups = expandIPv6(normalized);
  if (groups.length !== 8) return true; // unparseable, treat as unsafe

  const first = parseInt(groups[0] || "0", 16);
  const second = parseInt(groups[1] || "0", 16);

  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  // IPv4-mapped ::ffff:a.b.c.d
  if (first === 0 && second === 0) {
    const rest = groups.slice(0, 5);
    if (rest.every((g) => parseInt(g, 16) === 0) && parseInt(groups[5], 16) === 0xffff) {
      const v4 = [
        parseInt(groups[6], 16) >> 8,
        parseInt(groups[6], 16) & 0xff,
        parseInt(groups[7], 16) >> 8,
        parseInt(groups[7], 16) & 0xff,
      ].join(".");
      return isPrivateIPv4(v4);
    }
  }

  return false;
}

function isLoopbackOrPrivate(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

/**
 * Cloud metadata services must never be reachable, not even when private hosts
 * are explicitly allowed (they are only private when reached from inside a VPC).
 */
function isMetadataAddress(ip) {
  if (net.isIP(ip) === 4) return ip === "169.254.169.254";
  if (net.isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    return normalized === "fd00:ec2::254" || normalized.startsWith("fe80:");
  }
  return true;
}

function allowPrivateHosts() {
  return process.env.BYOK_ALLOW_PRIVATE_HOSTS === "true";
}

function assertAllowedHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) {
    throw new AppError(400, "baseUrl tidak diizinkan: host tidak valid");
  }
  const bare = host.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(bare) || bare.endsWith(".local") || bare.endsWith(".internal")) {
    if (!allowPrivateHosts()) {
      throw new AppError(400, "baseUrl tidak diizinkan: host privat/loopback");
    }
  }
  return bare;
}

/**
 * Validate a user-supplied BYOK base URL against SSRF. Resolves the hostname so
 * a public-looking name that points at a private address is still rejected.
 * Successful resolutions are cached briefly to avoid a DNS lookup per request.
 */
async function assertSafeByokBaseUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AppError(400, "baseUrl harus URL http(s) yang valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(400, "baseUrl harus URL http(s) yang valid");
  }
  if (url.username || url.password) {
    throw new AppError(400, "baseUrl tidak boleh memuat kredensial");
  }

  const hostname = assertAllowedHostname(url.hostname);
  const allowPrivate = allowPrivateHosts();

  const cached = resolutionCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    if (!cached.allowed) {
      throw new AppError(400, "baseUrl tidak diizinkan: host privat/loopback");
    }
    return rawUrl;
  }

  let addresses;
  if (net.isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const resolved = await dns.promises.lookup(hostname, { all: true });
      addresses = resolved.map((entry) => entry.address);
    } catch {
      throw new AppError(400, "baseUrl tidak dapat di-resolve: host tidak ditemukan");
    }
  }

  if (addresses.length === 0) {
    throw new AppError(400, "baseUrl tidak dapat di-resolve: host tidak ditemukan");
  }

  for (const address of addresses) {
    if (isMetadataAddress(address)) {
      throw new AppError(400, "baseUrl tidak diizinkan: alamat metadata cloud");
    }
    if (!allowPrivate && isLoopbackOrPrivate(address)) {
      throw new AppError(400, "baseUrl tidak diizinkan: host privat/loopback");
    }
  }

  resolutionCache.set(hostname, {
    allowed: true,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return rawUrl;
}

function __clearUrlSafetyCache() {
  resolutionCache.clear();
}

module.exports = {
  assertSafeByokBaseUrl,
  __clearUrlSafetyCache,
  isPrivateIPv4,
  isPrivateIPv6,
  isMetadataAddress,
};
