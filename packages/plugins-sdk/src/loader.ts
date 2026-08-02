import { isPluginManifest } from "./contracts/manifest";
import { isPlugin, type Plugin } from "./contracts/plugin";
import { InvalidManifestError, InvalidPluginError } from "./errors";
import type { PluginRegistry } from "./registry";

/**
 * Um candidato a plugin ainda não validado. `source` é só um rótulo para
 * mensagens de erro (ex.: caminho do pacote, URL, nome do módulo) — o
 * Loader não interpreta esse valor.
 */
export interface PluginCandidate {
  readonly source: string;
  readonly value: unknown;
}

/**
 * Descobre candidatos a plugin. Deliberadamente abstrato: filesystem, um
 * registry HTTP, um array hardcoded em teste — tudo isso é um PluginSource
 * válido. O Loader nunca acessa disco/rede diretamente.
 */
export interface PluginSource {
  discover(): Promise<PluginCandidate[]> | PluginCandidate[];
}

export interface LoadRejection {
  readonly source: string;
  readonly reason: string;
}

export interface LoadResult {
  readonly loaded: readonly Plugin[];
  readonly rejected: readonly LoadRejection[];
}

/**
 * Valida candidatos (forma da interface Plugin + schema do manifesto) e
 * registra os válidos em um PluginRegistry. Não sabe nada sobre onde os
 * candidatos vieram — recebe isso de um PluginSource injetado.
 *
 * Um candidato inválido nunca lança para fora de loadAll: ele vira uma
 * entrada em `rejected`, para que um plugin malformado não impeça os
 * demais de carregar.
 */
export class PluginLoader {
  constructor(private readonly registry: PluginRegistry) {}

  async loadAll(source: PluginSource): Promise<LoadResult> {
    const candidates = await source.discover();
    const loaded: Plugin[] = [];
    const rejected: LoadRejection[] = [];

    for (const candidate of candidates) {
      try {
        const plugin = this.validate(candidate);
        this.registry.register(plugin);
        loaded.push(plugin);
      } catch (error) {
        rejected.push({
          source: candidate.source,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { loaded, rejected };
  }

  private validate(candidate: PluginCandidate): Plugin {
    if (!isPlugin(candidate.value)) {
      throw new InvalidPluginError(
        candidate.source,
        "não implementa a interface Plugin (manifest/onStart/onStop ausentes).",
      );
    }
    if (!isPluginManifest(candidate.value.manifest)) {
      throw new InvalidManifestError(candidate.source);
    }
    return candidate.value;
  }
}
