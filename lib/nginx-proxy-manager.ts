import crypto from "node:crypto";
import fs from "node:fs";

type NpmProxyHost = {
  id: number;
  domain_names: string[];
  forward_scheme: string;
  forward_host: string;
  forward_port: number;
  certificate_id: number;
  ssl_forced: boolean;
  hsts_enabled: boolean;
  hsts_subdomains: boolean;
  http2_support: boolean;
  block_exploits: boolean;
  caching_enabled: boolean;
  allow_websocket_upgrade: boolean;
  enabled: boolean;
  access_list_id: number;
  advanced_config: string;
  meta?: Record<string, unknown> | null;
  locations?: unknown[] | null;
};

type NpmCertificate = {
  id: number;
  provider: string;
  nice_name: string;
  domain_names: string[];
  expires_on: string | null;
  meta?: Record<string, unknown> | null;
};

let cachedUserToken: { token: string; expiresAt: number } | null = null;

function getApiBaseUrl() {
  const baseUrl = String(process.env.NPM_PROXY_MANAGER_API_URL || "").trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("未配置 NPM_PROXY_MANAGER_API_URL");
  }
  return baseUrl;
}

function getKeysPath() {
  const keysPath = String(process.env.NPM_PROXY_MANAGER_KEYS_PATH || "").trim();
  if (!keysPath) {
    throw new Error("未配置 NPM_PROXY_MANAGER_KEYS_PATH");
  }
  return keysPath;
}

function getCustomerManagedMeta(customerId: string) {
  return {
    customer_managed_domain: true,
    customer_id: customerId,
    source: "parksonim_customer_settings",
  };
}

function toBase64Url(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createBootstrapAdminToken() {
  const keys = JSON.parse(fs.readFileSync(getKeysPath(), "utf8")) as { key: string };
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: "api",
    attrs: { id: 1 },
    scope: ["admin"],
    jti: crypto.randomBytes(12).toString("base64").substring(-8),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  };
  const signingInput = `${toBase64Url(header)}.${toBase64Url(payload)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(keys.key, "base64url");
  return `${signingInput}.${signature}`;
}

async function getUserScopedToken() {
  if (cachedUserToken && cachedUserToken.expiresAt > Date.now() + 60_000) {
    return cachedUserToken.token;
  }

  const bootstrapToken = createBootstrapAdminToken();
  const response = await fetch(`${getApiBaseUrl()}/tokens?scope=user`, {
    headers: {
      Authorization: `Bearer ${bootstrapToken}`,
    },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.token) {
    throw new Error(payload?.error?.message || "无法获取 Nginx Proxy Manager 访问令牌");
  }

  const expiresAt = payload?.expires ? new Date(payload.expires).getTime() : Date.now() + 50 * 60_000;
  cachedUserToken = {
    token: payload.token,
    expiresAt,
  };
  return payload.token as string;
}

async function npmRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getUserScopedToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    signal: init?.signal || AbortSignal.timeout(15 * 60_000),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new Error(
      (typeof payload === "object" && payload?.error?.message) ||
        (typeof payload === "string" ? payload : null) ||
        `NPM 请求失败（${response.status}）`,
    );
  }
  return payload as T;
}

function hostOwnsDomain(host: NpmProxyHost, domain: string) {
  return Array.isArray(host.domain_names) && host.domain_names.includes(domain);
}

function hostBelongsToCustomer(host: NpmProxyHost, customerId: string) {
  return (
    typeof host.meta === "object" &&
    host.meta !== null &&
    host.meta.customer_managed_domain === true &&
    host.meta.customer_id === customerId
  );
}

export async function listNpmProxyHosts() {
  return await npmRequest<NpmProxyHost[]>("/nginx/proxy-hosts");
}

export async function listNpmCertificates() {
  return await npmRequest<NpmCertificate[]>("/nginx/certificates");
}

async function testDomainReachability(domain: string) {
  const result = await npmRequest<Record<string, string>>("/nginx/certificates/test-http", {
    method: "POST",
    body: JSON.stringify({ domains: [domain] }),
  });
  return result[domain] || "unknown";
}

async function createLetsEncryptCertificate(domain: string) {
  return await npmRequest<NpmCertificate>("/nginx/certificates", {
    method: "POST",
    body: JSON.stringify({
      provider: "letsencrypt",
      domain_names: [domain],
      meta: {
        dns_challenge: false,
      },
    }),
  });
}

async function updateProxyHost(hostId: number, payload: Partial<NpmProxyHost>) {
  return await npmRequest<NpmProxyHost>(`/nginx/proxy-hosts/${hostId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function createProxyHost(payload: Partial<NpmProxyHost>) {
  return await npmRequest<NpmProxyHost>("/nginx/proxy-hosts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function disableProxyHost(hostId: number) {
  return await npmRequest<boolean>(`/nginx/proxy-hosts/${hostId}/disable`, {
    method: "POST",
  });
}

function buildManagedProxyPayload(params: {
  domain: string;
  customerId: string;
  certificateId?: number;
  enabled?: boolean;
}) {
  const hasCertificate = Boolean(params.certificateId && params.certificateId > 0);
  return {
    domain_names: [params.domain],
    forward_scheme: "http",
    forward_host: "parksonim-app",
    forward_port: 3000,
    certificate_id: hasCertificate ? params.certificateId : 0,
    ssl_forced: hasCertificate,
    hsts_enabled: hasCertificate,
    hsts_subdomains: false,
    http2_support: hasCertificate,
    block_exploits: true,
    caching_enabled: false,
    allow_websocket_upgrade: true,
    access_list_id: 0,
    advanced_config: "",
    enabled: params.enabled !== false,
    locations: [],
    meta: getCustomerManagedMeta(params.customerId),
  } satisfies Partial<NpmProxyHost>;
}

async function ensureManagedProxyHost(params: {
  customerId: string;
  domain: string;
  certificateId?: number;
  enabled?: boolean;
}) {
  const proxyHosts = await listNpmProxyHosts();
  const existing = proxyHosts.find((host) => hostOwnsDomain(host, params.domain));
  if (existing && !hostBelongsToCustomer(existing, params.customerId)) {
    throw new Error("该域名已在网关中被其他服务占用");
  }

  const payload = buildManagedProxyPayload(params);
  if (existing) {
    return await updateProxyHost(existing.id, payload);
  }
  return await createProxyHost(payload);
}

async function ensureCertificate(domain: string) {
  const certificates = await listNpmCertificates();
  const existing = certificates.find(
    (item) =>
      item.provider === "letsencrypt" &&
      Array.isArray(item.domain_names) &&
      item.domain_names.length === 1 &&
      item.domain_names[0] === domain,
  );
  if (existing) {
    return existing;
  }
  return await createLetsEncryptCertificate(domain);
}

export async function disableCustomerManagedDomain(params: {
  customerId: string;
  domain?: string | null;
}) {
  if (!params.domain) return;
  const proxyHosts = await listNpmProxyHosts();
  const targets = proxyHosts.filter(
    (host) => hostBelongsToCustomer(host, params.customerId) && hostOwnsDomain(host, params.domain!),
  );
  for (const host of targets) {
    if (host.enabled) {
      await disableProxyHost(host.id);
    }
  }
}

export async function provisionCustomerCustomDomain(params: {
  customerId: string;
  domain: string;
}) {
  await ensureManagedProxyHost({
    customerId: params.customerId,
    domain: params.domain,
    enabled: true,
  });

  const reachability = await testDomainReachability(params.domain);
  if (reachability !== "ok" && reachability !== "wrong-data") {
    return {
      status: "pending_verification" as const,
      message:
        reachability === "wrong-data"
          ? `域名已保存，解析已完成，正在等待 HTTPS 校验，请点“检查解析”继续`
          : `域名已保存，请先将 ${params.domain} 解析到当前服务器后，再点“检查解析”`,
      reachability,
    };
  }

  const certificate = await ensureCertificate(params.domain);
  await ensureManagedProxyHost({
    customerId: params.customerId,
    domain: params.domain,
    certificateId: certificate.id,
    enabled: true,
  });

  return {
    status: "active" as const,
    message: "自有域名已绑定，HTTPS 已启用",
    reachability,
    certificateId: certificate.id,
  };
}
