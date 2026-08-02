# @nexus/plugin-host

Processo Node.js de longa duração que carrega e executa os plugins do Nexus (`packages/plugins/*`). Existe separado de `apps/web` porque integrações como MQTT, varredura de rede e watchers de Docker/Proxmox precisam manter conexões e estado vivos — algo que não cabe bem no modelo serverless/route-handler do Next.js.

Ainda não implementado — apenas a estrutura de pastas e o script de dev (`bun run --filter @nexus/plugin-host dev`).
