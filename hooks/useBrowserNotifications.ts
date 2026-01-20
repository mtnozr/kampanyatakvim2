import { useState, useEffect, useCallback } from 'react';

export type NotificationType = 'campaign' | 'task' | 'announcement' | 'reminder';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  onClick?: () => void;
}

export const useBrowserNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      console.warn('Browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const sendNotification = useCallback(
    (options: NotificationOptions) => {
      if (permission !== 'granted') {
        return null;
      }

      try {
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/calendar-icon.png',
          tag: options.tag,
          requireInteraction: false,
        });

        if (options.onClick) {
          notification.onclick = () => {
            window.focus();
            options.onClick?.();
            notification.close();
          };
        }

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        return notification;
      } catch (error) {
        console.error('Error sending notification:', error);
        return null;
      }
    },
    [permission]
  );

  const notifyNewCampaign = useCallback(
    (campaignTitle: string) => {
      sendNotification({
        title: 'Yeni Kampanya Eklendi',
        body: campaignTitle,
        tag: 'new-campaign',
      });
    },
    [sendNotification]
  );

  const notifyTaskAssignment = useCallback(
    (taskTitle: string, assignedBy: string) => {
      sendNotification({
        title: 'Yeni Görev Atandı',
        body: `${assignedBy} size "${taskTitle}" görevini atadı`,
        tag: 'task-assignment',
      });
    },
    [sendNotification]
  );

  const notifyNewAnnouncement = useCallback(
    (announcementTitle: string) => {
      sendNotification({
        title: 'Yeni Duyuru',
        body: announcementTitle,
        tag: 'new-announcement',
      });
    },
    [sendNotification]
  );

  const notifyCampaignReminder = useCallback(
    (campaignTitle: string, daysUntil: number) => {
      const dayText = daysUntil === 1 ? 'yarın' : `${daysUntil} gün sonra`;
      sendNotification({
        title: 'Kampanya Hatırlatması',
        body: `"${campaignTitle}" ${dayText} başlıyor`,
        tag: `reminder-${campaignTitle}`,
      });
    },
    [sendNotification]
  );

  return {
    permission,
    isSupported: typeof Notification !== 'undefined',
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    requestPermission,
    sendNotification,
    notifyNewCampaign,
    notifyTaskAssignment,
    notifyNewAnnouncement,
    notifyCampaignReminder,
  };
};
