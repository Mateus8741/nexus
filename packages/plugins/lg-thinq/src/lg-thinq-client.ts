import { randomBytes } from "node:crypto";

/**
 * LgThinqClient — cliente HTTP para a API oficial "LG ThinQ Connect"
 * (https://smartsolution.developer.lge.com), autenticada via Personal
 * Access Token (PAT) gerado pelo próprio usuário em connect-pat.lgthinq.com
 * — sem OAuth app review nem parceria comercial, ao contrário da antiga
 * ThinQ.Cloud B2B. Wire format confirmado lendo o código-fonte oficial dos
 * SDKs `pythinqconnect`/`jsthinqconnect` (github.com/thinq-connect).
 */

/** Região da API é derivada do country_code — mesma tabela usada pelos SDKs oficiais (thinqconnect/country.py). */
const REGION_BY_COUNTRY: Readonly<Record<string, "kic" | "aic" | "eic">> = {
  AU: "kic", BD: "kic", CN: "kic", HK: "kic", ID: "kic", IN: "kic", JP: "kic", KH: "kic",
  KR: "kic", LA: "kic", LK: "kic", MM: "kic", MY: "kic", NP: "kic", NZ: "kic", PH: "kic",
  SG: "kic", TH: "kic", TW: "kic", VN: "kic",
  AG: "aic", AR: "aic", AW: "aic", BB: "aic", BO: "aic", BR: "aic", BS: "aic", BZ: "aic",
  CA: "aic", CL: "aic", CO: "aic", CR: "aic", CU: "aic", DM: "aic", DO: "aic", EC: "aic",
  GD: "aic", GT: "aic", GY: "aic", HN: "aic", HT: "aic", JM: "aic", KN: "aic", LC: "aic",
  MX: "aic", NI: "aic", PA: "aic", PE: "aic", PR: "aic", PY: "aic", SR: "aic", SV: "aic",
  TT: "aic", US: "aic", UY: "aic", VC: "aic", VE: "aic",
  AE: "eic", AF: "eic", AL: "eic", AM: "eic", AO: "eic", AT: "eic", AZ: "eic", BA: "eic",
  BE: "eic", BF: "eic", BG: "eic", BH: "eic", BJ: "eic", BY: "eic", CD: "eic", CF: "eic",
  CG: "eic", CH: "eic", CI: "eic", CM: "eic", CV: "eic", CY: "eic", CZ: "eic", DE: "eic",
  DJ: "eic", DK: "eic", DZ: "eic", EE: "eic", EG: "eic", ES: "eic", ET: "eic", FI: "eic",
  FR: "eic", GA: "eic", GB: "eic", GE: "eic", GH: "eic", GM: "eic", GN: "eic", GQ: "eic",
  GR: "eic", HR: "eic", HU: "eic", IE: "eic", IL: "eic", IQ: "eic", IR: "eic", IS: "eic",
  IT: "eic", JO: "eic", KE: "eic", KG: "eic", KW: "eic", KZ: "eic", LB: "eic", LR: "eic",
  LT: "eic", LU: "eic", LV: "eic", LY: "eic", MA: "eic", MD: "eic", ME: "eic", MK: "eic",
  ML: "eic", MR: "eic", MT: "eic", MU: "eic", MW: "eic", NE: "eic", NG: "eic", NL: "eic",
  NO: "eic", OM: "eic", PK: "eic", PL: "eic", PS: "eic", PT: "eic", QA: "eic", RO: "eic",
  RS: "eic", RU: "eic", RW: "eic", SA: "eic", SD: "eic", SE: "eic", SI: "eic", SK: "eic",
  SL: "eic", SN: "eic", SO: "eic", ST: "eic", SY: "eic", TD: "eic", TG: "eic", TN: "eic",
  TR: "eic", TZ: "eic", UA: "eic", UG: "eic", UZ: "eic", XK: "eic", YE: "eic", ZA: "eic",
  ZM: "eic",
};

/**
 * Chave pública embutida nos SDKs oficiais da LG (thinqconnect/const.py) —
 * enviada por todo consumidor da API, não é um segredo por-usuário.
 */
const API_KEY = "v6GFvkweNo7DK7yD3ylIZ9w52aKBU0eJ7wLXkSR3";

export interface LgThinqClientOptions {
  readonly accessToken: string;
  /** UUID gerado pelo próprio cliente — identifica esta instância, não precisa de registro prévio para GET/POST básicos. */
  readonly clientId: string;
  /** Código de país (ISO 3166-1 alpha-2) da conta LG — determina a região da API (kic/aic/eic). */
  readonly countryCode: string;
}

export interface LgThinqDeviceSummary {
  readonly deviceId: string;
  readonly deviceInfo: {
    readonly deviceType: string;
    readonly modelName: string;
    readonly alias: string;
    readonly reportable: boolean;
  };
}

/** Formato livre — a árvore de resources/properties varia por deviceType/modelo, lida em runtime pelo provider. */
export type LgThinqProfile = Record<string, unknown>;
export type LgThinqState = Record<string, unknown>;

export class LgThinqApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "LgThinqApiError";
  }
}

function resolveBaseUrl(countryCode: string): string {
  const region = REGION_BY_COUNTRY[countryCode.toUpperCase()];
  if (!region) {
    throw new LgThinqApiError(`country_code "${countryCode}" não é suportado pela API ThinQ Connect.`);
  }
  return `https://api-${region}.lgthinq.com`;
}

/** Espelha `base64.urlsafe_b64encode(uuid4().bytes)[:-2]` do SDK oficial — Node já omite o padding "==" em base64url. */
function generateMessageId(): string {
  return randomBytes(16).toString("base64url");
}

export class LgThinqClient {
  private readonly baseUrl: string;

  constructor(private readonly options: LgThinqClientOptions) {
    this.baseUrl = resolveBaseUrl(options.countryCode);
  }

  async listDevices(): Promise<readonly LgThinqDeviceSummary[]> {
    const result = await this.request<readonly LgThinqDeviceSummary[]>("GET", "devices");
    return result ?? [];
  }

  async getDeviceProfile(deviceId: string): Promise<LgThinqProfile | undefined> {
    return this.request<LgThinqProfile>("GET", `devices/${encodeURIComponent(deviceId)}/profile`);
  }

  async getDeviceState(deviceId: string): Promise<LgThinqState | undefined> {
    return this.request<LgThinqState>("GET", `devices/${encodeURIComponent(deviceId)}/state`);
  }

  /**
   * Endpoint único e genérico para qualquer comando — o corpo é
   * `{ "<resource>": { "<property>": <valor> } }` (ex.:
   * `{ operation: { airConOperationMode: "POWER_ON" } }`), no mesmo espírito
   * dos "data points" da Tuya, mas auto-descritivo via `/profile`.
   */
  async controlDevice(deviceId: string, payload: Record<string, unknown>): Promise<void> {
    await this.request<unknown>("POST", `devices/${encodeURIComponent(deviceId)}/control`, payload, {
      "x-conditional-control": "true",
    });
  }

  private async request<T>(
    method: "GET" | "POST",
    endpoint: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T | undefined> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.options.accessToken}`,
      "x-country": this.options.countryCode,
      "x-message-id": generateMessageId(),
      "x-client-id": this.options.clientId,
      "x-api-key": API_KEY,
      "x-service-phase": "OP",
      ...extraHeaders,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      response?: T;
      error?: { code?: string; message?: string };
    };

    if (!response.ok) {
      throw new LgThinqApiError(
        payload.error?.message ?? `LG ThinQ Connect API retornou HTTP ${response.status} para ${method} ${endpoint}.`,
        payload.error?.code,
      );
    }

    return payload.response;
  }
}
