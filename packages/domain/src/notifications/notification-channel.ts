/**
 * Uma notificação genérica a ser entregue — sem nenhuma suposição sobre o
 * canal (Discord, Telegram, WhatsApp, push, e-mail...).
 */
export interface Notification {
  readonly title: string;
  readonly message: string;
  /** Livre, específico do que gerou a notificação (ex.: `{ deviceId }`). */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * NotificationChannel — port que um canal concreto de notificação
 * implementa. Nesta etapa só existe infraestrutura (ver
 * NotificationCenter, em @nexus/application) — nenhuma integração real
 * (Discord/Telegram/WhatsApp/push/e-mail) foi implementada ainda, de
 * propósito.
 */
export interface NotificationChannel {
  readonly id: string;
  send(notification: Notification): Promise<void>;
}
