import { createHash, createHmac, randomUUID } from "node:crypto";

/**
 * TuyaClient — cliente HTTP para a Tuya Cloud API (OpenAPI), incluindo
 * assinatura HMAC-SHA256 das requisições conforme:
 * https://developer.tuya.com/en/docs/iot/new-singnature (Sign Requests for
 * Cloud Authorization).
 *
 * Só fala com a nuvem da Tuya (nenhum Local Key / rede local envolvido) —
 * por isso funciona de qualquer lugar onde o Core estiver hospedado,
 * inclusive fora da rede onde os dispositivos Tuya vivem.
 */

export interface TuyaClientOptions {
  readonly accessId: string;
  readonly accessSecret: string;
  /** Data center da Tuya IoT Platform. Ver "Endpoints" na doc de Request Structure. */
  readonly endpoint?: string;
}

export interface TuyaDeviceStatusItem {
  readonly code: string;
  readonly value: unknown;
}

export interface TuyaDeviceDto {
  readonly id: string;
  readonly uid?: string;
  readonly name: string;
  readonly category: string;
  readonly product_id?: string;
  readonly product_name?: string;
  readonly ip?: string;
  readonly online: boolean;
  readonly status: readonly TuyaDeviceStatusItem[];
}

interface TuyaEnvelope<T> {
  readonly success: boolean;
  readonly code?: number;
  readonly msg?: string;
  readonly result?: T;
}

interface TuyaTokenResult {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expire_time: number;
  readonly uid: string;
}

export class TuyaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "TuyaApiError";
  }
}

const DEFAULT_ENDPOINT = "https://openapi.tuyaus.com";
/** Margem de segurança antes do token expirar de verdade (a Tuya normalmente dá 2h). */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hmacSha256Upper(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex").toUpperCase();
}

function buildSignedUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const entries = Object.entries(query ?? {}).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined,
  );
  if (entries.length === 0) return path;

  const sorted = entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const queryString = sorted.map(([key, value]) => `${key}=${String(value)}`).join("&");
  return `${path}?${queryString}`;
}

export class TuyaClient {
  private readonly endpoint: string;
  private cachedToken: { accessToken: string; expiresAt: number } | undefined;

  constructor(private readonly options: TuyaClientOptions) {
    this.endpoint = options.endpoint?.trim() || DEFAULT_ENDPOINT;
  }

  /** Lista os dispositivos vinculados a um usuário Tuya (Smart Life / Tuya App), com paginação. */
  async getUserDevices(uid: string): Promise<readonly TuyaDeviceDto[]> {
    const devices: TuyaDeviceDto[] = [];
    const pageSize = 100;
    let pageNo = 1;

    // Limite de segurança: nunca gira mais que 20 páginas (2000 dispositivos)
    // numa única sincronização, mesmo que a API nunca "acabe" por algum motivo.
    for (let i = 0; i < 20; i++) {
      const page = await this.request<readonly TuyaDeviceDto[]>({
        method: "GET",
        path: `/v1.0/users/${encodeURIComponent(uid)}/devices`,
        query: { page_no: pageNo, page_size: pageSize },
        requiresToken: true,
      });
      const items = page ?? [];
      devices.push(...items);
      if (items.length < pageSize) break;
      pageNo += 1;
    }

    return devices;
  }

  async getDevice(deviceId: string): Promise<TuyaDeviceDto | undefined> {
    return this.request<TuyaDeviceDto>({
      method: "GET",
      path: `/v1.0/devices/${encodeURIComponent(deviceId)}`,
      requiresToken: true,
    });
  }

  /**
   * Envia comandos (data points) para um dispositivo — ex.:
   * `sendCommands("abc123", [{ code: "switch_1", value: true }])`.
   * Endpoint padrão da "Standard Instruction Set" da Tuya (`iot-03`), usado
   * por praticamente todo integrador Tuya (Home Assistant, tinytuya etc.).
   */
  async sendCommands(
    deviceId: string,
    commands: ReadonlyArray<{ readonly code: string; readonly value: unknown }>,
  ): Promise<void> {
    await this.request<unknown>({
      method: "POST",
      path: `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/commands`,
      body: { commands },
      requiresToken: true,
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
      return this.cachedToken.accessToken;
    }

    const result = await this.request<TuyaTokenResult>({
      method: "GET",
      path: "/v1.0/token",
      query: { grant_type: 1 },
      requiresToken: false,
    });

    if (!result) {
      throw new TuyaApiError("Tuya não retornou um token de acesso.");
    }

    this.cachedToken = {
      accessToken: result.access_token,
      expiresAt: Date.now() + result.expire_time * 1000,
    };
    return this.cachedToken.accessToken;
  }

  private async request<T>(input: {
    readonly method: "GET" | "POST" | "PUT" | "DELETE";
    readonly path: string;
    readonly query?: Record<string, string | number | undefined>;
    readonly body?: unknown;
    readonly requiresToken: boolean;
  }): Promise<T | undefined> {
    const accessToken = input.requiresToken ? await this.getAccessToken() : undefined;
    const url = buildSignedUrl(input.path, input.query);
    const bodyString = input.body !== undefined ? JSON.stringify(input.body) : "";
    const contentSha256 = sha256Hex(bodyString);
    const t = Date.now().toString();
    const nonce = randomUUID().replace(/-/g, "");

    const stringToSign = [input.method, contentSha256, "", url].join("\n");
    const signSource = accessToken
      ? `${this.options.accessId}${accessToken}${t}${nonce}${stringToSign}`
      : `${this.options.accessId}${t}${nonce}${stringToSign}`;
    const sign = hmacSha256Upper(signSource, this.options.accessSecret);

    const headers: Record<string, string> = {
      client_id: this.options.accessId,
      sign,
      sign_method: "HMAC-SHA256",
      t,
      nonce,
    };
    if (accessToken) headers.access_token = accessToken;
    if (input.body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${this.endpoint}${url}`, {
      method: input.method,
      headers,
      body: input.body !== undefined ? bodyString : undefined,
    });

    const payload = (await response.json().catch(() => ({}))) as TuyaEnvelope<T>;

    if (!response.ok || payload.success === false) {
      throw new TuyaApiError(
        payload.msg ?? `Tuya API retornou HTTP ${response.status} para ${input.method} ${url}.`,
        payload.code,
      );
    }

    return payload.result;
  }
}
