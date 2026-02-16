import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

function getNotificationsModule(): NotificationsModule | null {
    if (Platform.OS === 'web') {
        return null;
    }
    try {
        return require('expo-notifications') as NotificationsModule;
    } catch (error) {
        console.warn('expo-notifications is unavailable:', error);
        return null;
    }
}

export function configureNotificationHandler() {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
}

export async function registerForPushNotificationsAsync() {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        return;
    }

    //   token = (await Notifications.getExpoPushTokenAsync()).data;
    //   return token;
}

export async function scheduleLocalNotification(title: string, body: string, seconds: number = 1) {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: seconds < 1 ? 1 : seconds,
            repeats: false
        },
    });
}
