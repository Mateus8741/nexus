import fs from "node:fs";
import path from "node:path";

import { app, safeStorage } from "electron";

import type { AppConfig, SaveConfigInput } from "../shared/types";

interface StoredConfig {
  coreUrl: string;
  deviceName: string;
  environmentName: string;
  launchAtLogin: boolean;
  runAgent: boolean;
  pinned: boolean;
  /** Base64 da chave criptografada via safeStorage (Keychain/DPAPI); fallback texto puro prefixado `plain:`. */
  apiKeyEnc?: string;
  widgetPosition?: { x: number; y: number };
}

const DEFAULTS: StoredConfig = {
  coreUrl: "",
  deviceName: "",
  environmentName: "Nexus",
  launchAtLogin: true,
  runAgent: true,
  pinned: false,
};

/** Config persistida em `userData/config.json`. A API key nunca sai do processo main. */
export class ConfigStore {
  private readonly file = path.join(app.getPath("userData"), "config.json");
  private data: StoredConfig;

  constructor() {
    this.data = { ...DEFAULTS, ...this.read() };
  }

  private read(): Partial<StoredConfig> {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf-8")) as Partial<StoredConfig>;
    } catch {
      return {};
    }
  }

  private write(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), { mode: 0o600 });
  }

  isConfigured(): boolean {
    return this.data.coreUrl.length > 0 && Boolean(this.data.apiKeyEnc);
  }

  get(demo: boolean): AppConfig {
    const { coreUrl, deviceName, environmentName, launchAtLogin, runAgent, pinned } = this.data;
    return {
      coreUrl,
      deviceName,
      environmentName,
      launchAtLogin,
      runAgent,
      pinned,
      hasApiKey: Boolean(this.data.apiKeyEnc),
      demo,
    };
  }

  getApiKey(): string | undefined {
    const stored = this.data.apiKeyEnc;
    if (!stored) return undefined;
    if (stored.startsWith("plain:")) return stored.slice("plain:".length);
    try {
      return safeStorage.decryptString(Buffer.from(stored, "base64"));
    } catch {
      return undefined;
    }
  }

  save(input: SaveConfigInput): void {
    this.data.coreUrl = input.coreUrl.trim().replace(/\/+$/, "");
    this.data.deviceName = input.deviceName.trim();
    this.data.environmentName = input.environmentName.trim() || DEFAULTS.environmentName;
    this.data.launchAtLogin = input.launchAtLogin;
    this.data.runAgent = input.runAgent;
    const key = input.apiKey?.trim();
    if (key) {
      this.data.apiKeyEnc = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(key).toString("base64")
        : `plain:${key}`;
    }
    this.write();
  }

  setPinned(pinned: boolean): void {
    this.data.pinned = pinned;
    this.write();
  }

  get widgetPosition(): { x: number; y: number } | undefined {
    return this.data.widgetPosition;
  }

  setWidgetPosition(position: { x: number; y: number }): void {
    this.data.widgetPosition = position;
    this.write();
  }
}
