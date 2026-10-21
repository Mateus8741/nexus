/**
 * HomeAssistantClient — cliente HTTP fino para a API REST do Home Assistant
 * (`GET /api/states`, `POST /api/services/<domínio>/<serviço>`), autenticado
 * com um token de acesso de longa duração (Bearer).
 *
 * Portado de house-control (HomeAssistantService.swift). Regras mantidas:
 * timeout de 10 s por requisição, URL normalizada (padrão http://, porta 8123
 * implícita para `*.local`/`homeassistant`), 401/403 virando erro claro.
 * O token NUNCA é logado nem incluído em mensagens de erro.
 */

export interface HomeAssistantClientOptions {
  /** Endereço da instância (ex.: `homeassistant.local:8123`, `https://ha.exemplo.com`). */
  readonly baseUrl: string;
  /** Token de acesso de longa duração (Perfil → Segurança no Home Assistant). */
  readonly token: string;
  /** Timeout por requisição (ms). Padrão: 10 000. */
  readonly timeoutMs?: number;
  /** Injetável para testes; padrão: `fetch` global. */
  readonly fetchImpl?: typeof fetch;
}

/** Estado de uma entidade, como devolvido por `GET /api/states`. */
export interface HaEntityState {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface HaServiceCall {
  readonly domain: string;
  readonly service: string;
  /** Corpo JSON do serviço (inclui `entity_id`). */
  readonly data: Readonly<Record<string, unknown>>;
}

export class HomeAssistantApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HomeAssistantApiError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;
const ENTITY_ID_PATTERN = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const SERVICE_NAME_PATTERN = /^[a-z0-9_]+$/;

/**
 * "homeassistant.local" → "http://homeassistant.local:8123". Lança erro para
 * vazio ou esquema que não seja http/https.
 */
export function normalizeBaseUrl(raw: string): string {
  let text = raw.trim();
  if (text.length === 0) {
    throw new HomeAssistantApiError(
      "Informe o endereço do Home Assistant, por exemplo http://homeassistant.local:8123.",
    );
  }
  if (!text.includes("://")) text = `http://${text}`;
  while (text.endsWith("/")) text = text.slice(0, -1);

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new HomeAssistantApiError(`"${raw.trim()}" não é um endereço web válido.`);
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname.length === 0) {
    throw new HomeAssistantApiError(`"${raw.trim()}" não é um endereço http(s) válido.`);
  }
  // Credenciais embutidas na URL vazariam em logs; o token vai só no header.
  if (url.username || url.password) {
    throw new HomeAssistantApiError("O endereço do Home Assistant não pode conter usuário/senha.");
  }

  const defaultsToHaPort =
    url.protocol === "http:" &&
    url.port === "" &&
    (url.hostname.endsWith(".local") || url.hostname === "homeassistant");
  if (defaultsToHaPort) url.port = "8123"; // porta padrão do HA, que as pessoas omitem

  // Preserva um eventual prefixo de caminho (HA atrás de proxy), sem barra final.
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}`;
}

export class HomeAssistantClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HomeAssistantClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    const token = options.token.trim();
    if (token.length === 0) {
      throw new HomeAssistantApiError(
        "Informe um token de acesso de longa duração (Perfil → Segurança no Home Assistant).",
      );
    }
    // Evita injeção de header (CR/LF) e caracteres fora de ASCII imprimível.
    if (!/^[\x21-\x7e]+$/.test(token)) {
      throw new HomeAssistantApiError("O token do Home Assistant contém caracteres inválidos.");
    }
    this.token = token;
    this.timeoutMs =
      Number.isFinite(options.timeoutMs) && (options.timeoutMs as number) > 0
        ? Math.round(options.timeoutMs as number)
        : DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** URL normalizada (sem token) — segura para logs. */
  get url(): string {
    return this.baseUrl;
  }

  /** `GET /api/states` — estado de todas as entidades. */
  async getStates(): Promise<readonly HaEntityState[]> {
    const payload = await this.requestJson("GET", "/api/states");
    if (!Array.isArray(payload)) return [];
    return payload.filter(isEntityState);
  }

  /** `GET /api/states/<entity_id>` — estado de uma entidade (undefined se não existir). */
  async getState(entityId: string): Promise<HaEntityState | undefined> {
    assertEntityId(entityId);
    try {
      const payload = await this.requestJson("GET", `/api/states/${entityId}`);
      return isEntityState(payload) ? payload : undefined;
    } catch (error) {
      if (error instanceof HomeAssistantApiError && error.status === 404) return undefined;
      throw error;
    }
  }

  /**
   * Área de cada entidade, numa única requisição de template (a API REST não
   * tem endpoint de áreas). Best-effort: devolve vazio se falhar.
   */
  async getAreaNames(): Promise<ReadonlyMap<string, string>> {
    const template =
      "{% for e in states %}{{ e.entity_id }}\t{{ area_name(e.entity_id) or '' }}\n{% endfor %}";
    try {
      const text = await this.request("POST", "/api/template", { template });
      return parseAreaTemplate(typeof text === "string" ? text : "");
    } catch {
      return new Map();
    }
  }

  async callService(call: HaServiceCall): Promise<void> {
    if (!SERVICE_NAME_PATTERN.test(call.domain) || !SERVICE_NAME_PATTERN.test(call.service)) {
      throw new HomeAssistantApiError("Serviço Home Assistant inválido.");
    }
    assertNoNonFiniteNumbers(call.data);
    await this.requestJson("POST", `/api/services/${call.domain}/${call.service}`, call.data);
  }

  private async requestJson(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const text = await this.request(method, path, body);
    if (typeof text !== "string" || text.length === 0) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body: unknown,
  ): Promise<string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
        // Não segue redirecionamentos: o header Authorization não deve sair do host configurado.
        redirect: "error",
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new HomeAssistantApiError(
        timedOut
          ? `Home Assistant em ${this.baseUrl} não respondeu em ${this.timeoutMs / 1000}s.`
          : `Home Assistant em ${this.baseUrl} não respondeu (${describeNetworkError(error)}).`,
      );
    }

    const text = await response.text().catch(() => "");
    if (response.status >= 200 && response.status < 300) return text;

    if (response.status === 401 || response.status === 403) {
      throw new HomeAssistantApiError(
        "Home Assistant recusou o token. Crie um novo token de acesso de longa duração.",
        response.status,
      );
    }
    if (response.status === 404) {
      throw new HomeAssistantApiError(
        `Home Assistant não conhece ${path}. A API está habilitada?`,
        404,
      );
    }
    throw new HomeAssistantApiError(
      `Home Assistant respondeu HTTP ${response.status} ${text.slice(0, 200)}`.trim(),
      response.status,
    );
  }
}

/** "light.sala\tSala\n..." → mapa entity_id → área (ignora vazio/"None"). */
export function parseAreaTemplate(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const entity = line.slice(0, tab).trim();
    const area = line.slice(tab + 1).trim();
    if (entity && area && area !== "None") out.set(entity, area);
  }
  return out;
}

function assertEntityId(entityId: string): void {
  if (!ENTITY_ID_PATTERN.test(entityId)) {
    throw new HomeAssistantApiError(`entity_id inválido: "${entityId}".`);
  }
}

function isEntityState(value: unknown): value is HaEntityState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.entity_id === "string" &&
    ENTITY_ID_PATTERN.test(record.entity_id) &&
    typeof record.state === "string" &&
    (record.attributes === undefined ||
      (typeof record.attributes === "object" && record.attributes !== null))
  );
}

/** Rede de segurança final: nada de NaN/Infinity no corpo de um serviço (JSON.stringify os viraria `null`). */
function assertNoNonFiniteNumbers(value: unknown): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new HomeAssistantApiError("Valor numérico inválido (NaN/Infinity).");
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoNonFiniteNumbers(item);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) assertNoNonFiniteNumbers(item);
  }
}

function describeNetworkError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: { code?: string } }).cause;
    return cause?.code ?? error.message;
  }
  return "erro de rede";
}
