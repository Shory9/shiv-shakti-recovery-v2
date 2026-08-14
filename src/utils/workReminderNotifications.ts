import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const CHANNEL_ID = "executive-work-reminders";
const REMINDER_IDS = [1010, 1012, 1014, 1016, 1018];
const REMINDER_HOURS = [10, 12, 14, 16, 18];

/**
 * Schedules daily executive work reminders on Android.
 * Returns a cleanup function for the notification-click listener.
 */
export async function initializeWorkReminders(
  openCases: () => void,
): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return async () => undefined;
  }

  let actionListener: PluginListenerHandle | undefined;

  try {
    const currentPermission = await LocalNotifications.checkPermissions();
    const permission =
      currentPermission.display === "granted"
        ? currentPermission
        : await LocalNotifications.requestPermissions();

    if (permission.display !== "granted") {
      return async () => undefined;
    }

    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Executive Work Reminders",
      description: "Check-in aur case working reminders",
      importance: 4,
      visibility: 1,
      vibration: true,
    });

    // Replace only this app's reminder IDs, never unrelated notifications.
    await LocalNotifications.cancel({
      notifications: REMINDER_IDS.map((id) => ({ id })),
    });

    await LocalNotifications.schedule({
      notifications: REMINDER_HOURS.map((hour, index) => ({
        id: REMINDER_IDS[index],
        title:
          hour === 10
            ? "Shiv Shakti: Check-in ka samay"
            : "Shiv Shakti: Case working reminder",
        body:
          hour === 10
            ? "10 baje check-in karke aaj ke assigned cases par working shuru karein."
            : "App kholkar assigned cases, visit aur follow-up status update karein.",
        channelId: CHANNEL_ID,
        schedule: {
          on: { hour, minute: 0 },
          repeats: true,
          allowWhileIdle: true,
        },
        extra: { destination: "cases" },
      })),
    });

    actionListener = await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (event) => {
        if (event.notification.extra?.destination === "cases") {
          openCases();
        }
      },
    );
  } catch (error) {
    console.error("Work reminder setup failed:", error);
  }

  return async () => {
    await actionListener?.remove();
  };
}
