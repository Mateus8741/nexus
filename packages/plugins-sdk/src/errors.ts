/**
 * Erros tipados do plugin system. Todos estendem PluginSdkError para que o
 * host possa fazer `error instanceof PluginSdkError` sem precisar conhecer
 * cada subtipo.
 */

export class PluginSdkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidManifestError extends PluginSdkError {
  constructor(source: string) {
    super(`Manifesto inválido em "${source}": não satisfaz o schema de PluginManifest.`);
  }
}

export class InvalidPluginError extends PluginSdkError {
  constructor(source: string, reason: string) {
    super(`Plugin inválido em "${source}": ${reason}`);
  }
}

export class PluginAlreadyRegisteredError extends PluginSdkError {
  constructor(pluginId: string) {
    super(`Plugin "${pluginId}" já está registrado.`);
  }
}

export class PluginNotFoundError extends PluginSdkError {
  constructor(pluginId: string) {
    super(`Plugin "${pluginId}" não foi encontrado no registry.`);
  }
}

export class InvalidPluginStateTransitionError extends PluginSdkError {
  constructor(pluginId: string, from: string, to: string) {
    super(`Transição de estado inválida para o plugin "${pluginId}": "${from}" -> "${to}".`);
  }
}
