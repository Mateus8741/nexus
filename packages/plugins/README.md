# packages/plugins

Convenção para plugins/integrações de primeira parte (ex.: Windows, MQTT, Docker, Proxmox, TrueNAS, Home Assistant).

Cada plugin é o seu próprio pacote do workspace, nomeado `@nexus/plugin-<nome>` (ex.: `@nexus/plugin-windows`, `@nexus/plugin-docker`, `@nexus/plugin-home-assistant`). Dependências permitidas:

- `@nexus/plugins-sdk` — sempre. É o "kernel API" (Plugin, PluginManifest, PluginContext, AgentGateway).
- `@nexus/domain` — quando o plugin expõe um `DeviceProvider` (a interface e os tipos `Device`/`DeviceState`/`DeviceEvent`/`DeviceAction` vêm de lá).
- `@nexus/agent-protocol` — só para plugins no "padrão Agent" (que aceitam conexões de um processo remoto via `AgentGateway`, ex.: Windows). Plugins que falam direto com uma API/daemon já existente (Docker, Home Assistant) não precisam disso.

Nunca: `@nexus/infrastructure`, `@nexus/application`, nem outro pacote de `packages/plugins/*` diretamente.

Estrutura esperada de cada plugin:

```
packages/plugins/<nome>/
├── package.json
├── tsconfig.json
├── plugin.manifest.json     # metadados: id, versão, capacidades declaradas
└── src/
    ├── index.ts             # valida o manifesto e exporta uma factory (ex.: createWindowsPlugin)
    └── <nome>-device-provider.ts   # implementa DeviceProvider, se aplicável
```

`packages/plugins/windows` é o primeiro plugin real e a referência para os próximos. `apps/plugin-host` é o processo (composition root) que instancia, carrega e executa esses pacotes em tempo de execução.
