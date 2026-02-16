import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { authEvents } from '../utils/auth-events';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const inAuthGroup = segments[0] === 'auth';

        if (!token && !inAuthGroup) {
          // No token, and not in auth group -> Redirect to Login
          router.replace('/auth/login');
        } else if (token && inAuthGroup) {
          // Has token, but in auth group -> Redirect to Profile (or Home)
          router.replace('/(tabs)/profile');
        }
      } catch (e) {
        console.error("Auth check failed", e);
      }
    };

    checkAuth();

    // Listen for global logout events (e.g. 401 from API)
    const unsubscribe = authEvents.subscribe(() => {
      // Force redirect to login even if segments haven't changed
      router.replace('/auth/login');
    });

    return () => {
      unsubscribe();
    };
  }, [segments, isMounted]);

  if (!isMounted) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false, // ✅ 全站關掉預設黑色 header
        }}
      />
    </GestureHandlerRootView>
  );
}
