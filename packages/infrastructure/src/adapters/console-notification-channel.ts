import type { Notification, NotificationChannel } from "@nexus/domain";

/**
 * NotificationChannel de exemplo: só loga no console. Existe para validar
 * o NotificationCenter (@nexus/application) fim a fim sem nenhuma
 * integração real (Discord/Telegram/WhatsApp/push/e-mail) — essas ficam
 * para uma etapa futura (ver ARCHITECTURE.md, "Notification Center").
 */
export class ConsoleNotificationChannel implements NotificationChannel {
  readonly id = "console";

  async send(notification: Notification): Promise<void> {
    console.log(
      `[notification] ${notification.title}: ${notification.message}`,
      notification.context ?? {},
    );
  }
}
