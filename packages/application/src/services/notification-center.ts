import type { Notification, NotificationChannel } from "@nexus/domain";

/**
 * NotificationCenter — registra NotificationChannel(s) e distribui uma
 * notificação para todos eles. Nesta etapa é só infraestrutura: nenhuma
 * integração real (Discord/Telegram/WhatsApp/push/e-mail) foi implementada
 * ainda, de propósito (ver ARCHITECTURE.md) — só o `ConsoleNotificationChannel`
 * de exemplo, em @nexus/infrastructure.
 */
export class NotificationCenter {
  private readonly channels = new Map<string, NotificationChannel>();

  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  unregisterChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  listChannels(): readonly NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  /** Uma falha num canal não impede os demais — mesma tolerância a falhas do resto do Core. */
  async notify(notification: Notification): Promise<void> {
    await Promise.allSettled(this.listChannels().map((channel) => channel.send(notification)));
  }
}
