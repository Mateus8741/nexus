# ports

Interfaces que a aplicação espera que a infraestrutura implemente (ex.: `EventBus`, `Clock`, `PluginRegistry`, `NotificationSender`).

São implementadas concretamente em `@nexus/infrastructure` e injetadas nos casos de uso — a aplicação nunca importa infraestrutura diretamente.
