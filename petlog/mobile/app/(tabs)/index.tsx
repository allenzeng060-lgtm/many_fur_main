import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  StatusBar,
  ScrollView,
  Dimensions,
  Platform,
  SafeAreaView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import Swipeable from "react-native-gesture-handler/Swipeable";
import { api, API_URL } from "../../utils/api";
import { LinearGradient } from 'expo-linear-gradient';
import { configureNotificationHandler, registerForPushNotificationsAsync, scheduleLocalNotification } from "../../utils/notifications";

const { width } = Dimensions.get('window');

type Pet = {
  id: number;
  name: string;
  species?: string;
  breed?: string;
  birth_date?: string;
  sex?: string;
  avatar_url?: string | null;
  owner_id: number;
};

type Reminder = {
  plan_id: number;
  code: string;
  name: string;
  category: string;
  interval_days: number;
  last_done_at?: string;
  next_due_at?: string;
  days_left?: number;
  status: "overdue" | "due_soon" | "ok" | "no_last_date";
  pet_name: string; // aggregated
  pet_id: number;   // aggregated
};

export default function HomeScreen() {
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingPetId, setDeletingPetId] = useState<number | null>(null);

  const [isGuest, setIsGuest] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (token === "guest_token") {
        setIsGuest(true);
        setPets([]);
        setReminders([]);
        setLoading(false);
        return;
      }
      setIsGuest(false);

      // 1. Load Pets
      const petList = await api.get("/pets");
      setPets(Array.isArray(petList) ? petList : []);

      // 2. Load Reminders for all pets
      if (Array.isArray(petList)) {
        const allReminders: Reminder[] = [];
        for (const pet of petList) {
          const petReminders = await api.get(`/pets/${pet.id}/reminders`);
          if (Array.isArray(petReminders)) {
            // Add pet context
            const contextualized = petReminders.map((r: any) => ({
              ...r,
              pet_name: pet.name,
              pet_id: pet.id
            }));
            allReminders.push(...contextualized);
          }
        }
        // Filter: only show overdue or due soon (<= 7 days)
        const urgent = allReminders.filter(r => r.status === 'overdue' || r.status === 'due_soon');

        // Sort by urgency
        urgent.sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999));
        setReminders(urgent);

        // Simple Check: Schedule Notifications if needed
        // Real-world: This should be handled by background tasks, but for MVP we check on app open
        checkAndSchedule(urgent);
      }

    } catch (e: any) {
      if (e.message !== "Unauthorized") {
        // console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAndSchedule = async (urgentReminders: Reminder[]) => {
    // Very basic: if we have urgent reminders, schedule a local notification
    // to remind user 10 seconds later (demo purpose)
    if (urgentReminders.length > 0) {
      await registerForPushNotificationsAsync();
      const first = urgentReminders[0];
      let msg = `${first.pet_name} 的 ${first.name} `;
      if (first.status === 'overdue') msg += `已經過期 ${Math.abs(first.days_left || 0)} 天了！`;
      else msg += `還有 ${first.days_left} 天到期！`;

      // Schedule one generic reminder for demo
      // In production, we'd check if already scheduled or use background fetch
      // await scheduleLocalNotification("照護提醒 🔔", msg, 5);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    configureNotificationHandler();
    loadData();
    registerForPushNotificationsAsync();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const confirmDeletePet = (pet: Pet) => {
    Alert.alert(
      "移除毛孩",
      `確定要移除「${pet.name}」嗎？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "移除",
          style: "destructive",
          onPress: async () => {
            setDeletingPetId(pet.id);
            try {
              await api.delete(`/pets/${pet.id}`);
              setPets((prev) => prev.filter((p) => p.id !== pet.id));
              setReminders((prev) => prev.filter((r) => r.pet_id !== pet.id));
            } catch (e: any) {
              Alert.alert("移除失敗", e?.message || String(e));
            } finally {
              setDeletingPetId(null);
            }
          },
        },
      ]
    );
  };

  const renderPetItem = ({ item }: { item: Pet }) => {
    const isCat = item.species === "cat";
    const avatarUri = item.avatar_url
      ? (item.avatar_url.startsWith("http") ? item.avatar_url : `${API_URL}${item.avatar_url}`)
      : null;
    const isDeleting = deletingPetId === item.id;
    return (
      <Swipeable
        containerStyle={styles.swipeContainer}
        overshootRight={false}
        friction={2}
        rightThreshold={36}
        renderRightActions={() => (
          <View style={styles.rightActionWrap}>
            <Pressable
              onPress={() => confirmDeletePet(item)}
              style={[styles.deleteActionBtn, isDeleting && styles.deleteActionBtnDisabled]}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#FFF" />
                  <Text style={styles.deleteActionText}>移除</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      >
        <Link href={`/pet/${item.id}`} asChild>
          <Pressable style={styles.petCard}>
            <View style={styles.petIconContainer}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.petAvatarImage} />
              ) : (
                <Text style={{ fontSize: 32 }}>{isCat ? "🐱" : "🐶"}</Text>
              )}
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{item.name}</Text>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{item.breed || "品種未知"}</Text>
                </View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#D1D5DB" />
          </Pressable>
        </Link>
      </Swipeable>
    );
  };

  const renderReminder = (item: Reminder) => {
    let icon = "alert-circle";
    let color = "#EF4444";
    let text = "過期";

    if (item.status === 'due_soon') {
      icon = "time";
      color = "#F59E0B";
      text = `${item.days_left}天後`;
    } else if (item.status === 'overdue') {
      text = `過期 ${Math.abs(item.days_left || 0)} 天`;
    }

    return (
      <Pressable
        key={`${item.pet_id}-${item.plan_id}`}
        style={styles.reminderCard}
        onPress={() => router.push(`/pet/${item.pet_id}`)}
      >
        <View style={[styles.reminderIcon, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reminderTitle}>{item.pet_name}: {item.name}</Text>
          <Text style={styles.reminderSub}>{text} • {item.category === 'vaccine' ? '疫苗' : '照顧'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </Pressable>
    )
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Bubbles */}
      <View pointerEvents="none" style={styles.bg}>
        <View style={[styles.bubble, styles.b1]} />
        <View style={[styles.bubble, styles.b2]} />
        <View style={[styles.bubble, styles.b3]} />
        <View style={[styles.bubble, styles.b4]} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>早安，</Text>
            <Text style={styles.subtitleText}>{isGuest ? "訪客" : "毛孩管家"} 🐾</Text>
          </View>
          {!isGuest && (
            <Link href="/add-pet" asChild>
              <Pressable style={styles.addBtn}>
                <Ionicons name="add" size={28} color="#FFF" />
              </Pressable>
            </Link>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />}
        >
          {/* Glassmorphism Feature Card / Hero */}
          <View style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.3)']}
              style={styles.heroGradient}
            >
              <View style={styles.heroItem}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{isGuest ? '-' : pets.length}</Text>
                  <Text style={styles.statLabel}>隻毛孩</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Guest Welcome Banner */}
          {isGuest && (
            <View style={styles.sectionContainer}>
              <View style={styles.emptyBox}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>👋</Text>
                <Text style={[styles.emptyText, { fontSize: 18, color: '#333' }]}>歡迎來到 毛很多！</Text>
                <Text style={styles.emptyText}>
                  您目前處於訪客模式，可以自由瀏覽「協尋大廳」查看走失寵物。
                </Text>
                <Pressable
                  style={{ marginTop: 20, backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                  onPress={async () => {
                    await AsyncStorage.clear();
                    router.replace('/auth/login');
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>前往登入 / 註冊</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Reminders Dashboard */}
          {!isGuest && reminders.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>待辦事項 🔔</Text>
              {reminders.map(renderReminder)}
            </View>
          )}


          {/* My Pets List */}
          {!isGuest && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>我的毛孩 🐶🐱</Text>
              {loading && pets.length === 0 ? (
                <Text style={styles.loadingText}>載入中...</Text>
              ) : pets.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={{ fontSize: 48 }}>🐶</Text>
                  <Text style={styles.emptyText}>還沒有寵物資料{"\n"}點擊上方「＋」新增第一隻毛孩吧！</Text>
                </View>
              ) : (
                pets.map(pet => (
                  <View key={pet.id}>
                    {renderPetItem({ item: pet })}
                  </View>
                ))
              )}
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Background Bubbles
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
  bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
  b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
  b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
  b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },
  b4: { width: 200, height: 200, right: 20, bottom: 100, backgroundColor: "#e2f6ff" },

  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 32,
    color: '#1F1F2A',
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  addBtn: {
    backgroundColor: '#1F1F2A',
    width: 52,
    height: 52,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100
  },

  // Hero Card
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 28,
    marginTop: 10,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
    backgroundColor: '#FFF'
  },
  heroGradient: {
    padding: 24,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 16
  },
  heroItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  heroBtn: {
    width: 64, height: 64, borderRadius: 22,
    marginBottom: 12,
    shadowColor: "#8B5CF6", shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  iconGradient: {
    flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 22
  },
  heroLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 4 },
  statBox: {
    width: 90, height: 90, borderRadius: 24,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2
  },
  statNum: { fontSize: 32, fontWeight: '900', color: '#1F2937' },
  statLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginTop: 2 },

  // Sections
  sectionContainer: { marginBottom: 28 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#111827', marginBottom: 14, letterSpacing: -0.3 },

  // Reminder Card
  reminderCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444'
  },
  reminderIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14
  },
  reminderTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  reminderSub: { fontSize: 14, color: '#6B7280', marginTop: 3, fontWeight: '500' },

  // Pet List
  loadingText: { textAlign: 'center', marginTop: 20, color: '#9CA3AF', fontSize: 15, fontWeight: '500' },
  petCard: {
    backgroundColor: '#FFF',
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    borderTopWidth: 1.5,
    borderTopColor: '#F3F4F6',
    marginBottom: 12
  },
  swipeContainer: {
    borderRadius: 22,
  },
  rightActionWrap: {
    width: 96,
    marginBottom: 12,
    marginLeft: 8
  },
  deleteActionBtn: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  deleteActionBtnDisabled: {
    opacity: 0.7
  },
  deleteActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800'
  },
  petIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 22,
    marginRight: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 40,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 1
  },
  petAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  petInfo: { flex: 1 },
  petName: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: '#F0F4FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 0.5, borderColor: '#E0E7FF'
  },
  chipText: { fontSize: 12, color: '#4F46E5', fontWeight: '600' },

  emptyBox: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(249,250,251,0.8) 100%)',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginTop: 16
  },
  emptyText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 26,
    fontSize: 15,
    fontWeight: '500'
  }
});
