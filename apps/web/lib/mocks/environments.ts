/**
 * Ambientes mockados — @nexus/domain ainda não tem a entidade Espaço/Ambiente
 * implementada, então isso é só um lookup local para o Dashboard ter algo
 * para agrupar os dispositivos mockados. Sem persistência, sem API.
 */
export interface MockEnvironment {
  readonly id: string;
  readonly name: string;
}

export const mockEnvironments: MockEnvironment[] = [
  { id: "space.casa-sala", name: "Casa · Sala" },
  { id: "space.casa-escritorio", name: "Casa · Escritório" },
  { id: "space.datacenter-rack-a", name: "Datacenter · Rack A" },
];
