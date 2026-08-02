# components

Componentes shadcn/ui (estilo `base-nova`, sobre `@base-ui/react`) vivem aqui: `button`, `separator`, `tooltip`, `scroll-area`, `avatar`, `input`. Portados manualmente do registry (`ui.shadcn.com/r/styles/base-nova/*.json`) porque o CLI (`bunx shadcn add`) não tem acesso de rede neste ambiente — o conteúdo é o mesmo que o CLI geraria, só com os imports ajustados para os aliases deste monorepo (`@nexus/ui/lib/utils`, etc.).

Para adicionar mais componentes normalmente (com acesso à internet): `cd apps/web && bunx shadcn@latest add <componente>`.
