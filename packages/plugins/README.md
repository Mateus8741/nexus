# packages/plugins

Convenção para plugins/integrações de primeira parte (ex.: MQTT, Docker, Proxmox, TrueNAS, Home Assistant).

Cada plugin é o seu próprio pacote do workspace, nomeado `@nexus/plugin-<nome>` (ex.: `@nexus/plugin-mqtt`, `@nexus/plugin-docker`, `@nexus/plugin-home-assistant`), e deve depender apenas de `@nexus/plugins-sdk` — nunca de `@nexus/infrastructure` ou de outro plugin diretamente.

Estrutura esperada de cada plugin:

```
packages/plugins/<nome>/
├── package.json
├── tsconfig.json
├── plugin.manifest.json   # metadados: id, versão, capacidades declaradas
└── src/
    └── index.ts           # implementa os contratos de @nexus/plugins-sdk
```

Nenhum plugin foi criado ainda — esta pasta existe apenas para registrar a convenção. `apps/plugin-host` é o processo que descobre, carrega e executa esses pacotes em tempo de execução.
