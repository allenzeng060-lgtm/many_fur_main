import React, { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  ActivityIndicator,
  StatusBar
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { api, API_URL } from "../../utils/api";

type User = {
  id: number;
  email: string;
  name: string;
  avatar_url?: string | null;
  created_at?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [petCount, setPetCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState("");
  const [updating, setUpdating] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (token === "guest_token") {
        setUser({ id: -1, email: "", name: "訪客", avatar_url: null, created_at: new Date().toISOString() });
        setPetCount(0);
        setLoading(false);
        return;
      }

      const [userData, petList] = await Promise.all([
        api.get("/auth/me"),
        api.get("/pets"),
      ]);
      setUser(userData);
      setPetCount(Array.isArray(petList) ? petList.length : 0);
    } catch (e: any) {
      if (e.message !== "Unauthorized") {
        Alert.alert("載入失敗", e?.message || String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleLogout = async () => {
    // If guest, just go to login
    if (user?.id === -1) {
      await AsyncStorage.clear();
      router.replace("/auth/login");
      return;
    }

    Alert.alert("登出", "確定要登出嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "登出",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const openEditModal = () => {
    if (user?.id === -1) {
      Alert.alert("訪客模式", "請先註冊或登入會員，才能編輯個人資料喔！");
      return;
    }
    if (user) {
      setEditName(user.name);
      setEditModalVisible(true);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("提醒", "暱稱不能是空的喔");
      return;
    }
    setUpdating(true);
    try {
      const updatedUser = await api.updateProfile({ name: editName.trim() });
      setUser(updatedUser);
      setEditModalVisible(false);
      Alert.alert("成功", "個人資料已更新");
    } catch (e: any) {
      Alert.alert("更新失敗", e.message);
    } finally {
      setUpdating(false);
    }
  };

  const resolveAvatarUri = (avatarUrl?: string | null) => {
    if (!avatarUrl) {
      return `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=e0e7ff&color=4f46e5&size=200`;
    }
    if (/^https?:\/\//i.test(avatarUrl) || avatarUrl.startsWith('data:')) {
      return avatarUrl;
    }
    return `${API_URL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}`;
  };

  // Image Upload Logic
  const pickImage = () => {
    if (isGuest) {
      Alert.alert("訪客模式", "請先註冊或登入會員，才能更換頭貼喔！");
      return;
    }

    Alert.alert(
      "更換頭貼",
      "請選擇來源",
      [
        { text: "拍照", onPress: launchCamera },
        { text: "從相簿選擇", onPress: launchLibrary },
        { text: "取消", style: "cancel" }
      ]
    );
  };

  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要權限', '請允許使用相機');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square for avatar
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要權限', '請允許存取相簿以選擇照片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (uri: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', {
        uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      });

      // 1. Upload Image
      const uploadRes = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('圖片上傳失敗');
      const uploadData = await uploadRes.json();

      // 2. Update User Profile with new avatar URL
      // Note: Backend might need to support updating avatar_url. 
      // If /me/profile only supports name, we might need to adjust backend or use a different endpoint.
      // Assuming api.updateProfile handles this or we call a specific endpoint.
      // For now, let's try updating profile with avatar_url if the API supports it, 
      // or just assume we need to send it.

      // Checking api.ts, updateProfile uses PUT /auth/me/profile. 
      // Let's assume passed object is merged.

      const updatedUser = await api.updateProfile({ avatar_url: uploadData.url });
      if (updatedUser && typeof updatedUser === "object") {
        setUser(updatedUser);
      } else {
        setUser(prev => (prev ? { ...prev, avatar_url: uploadData.url } : prev));
      }
      Alert.alert("成功", "頭貼已更新");

    } catch (e: any) {
      console.error(e);
      Alert.alert("上傳失敗", "更換頭貼失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date
  const joinYear = user?.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear();
  const isGuest = user?.id === -1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Background Bubbles (Bubbly Theme) */}
      <View pointerEvents="none" style={styles.bg}>
        <View style={[styles.bubble, styles.b1]} />
        <View style={[styles.bubble, styles.b2]} />
        <View style={[styles.bubble, styles.b3]} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header Card (Glassmorphism) */}
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            <Image
              source={{
                uri: resolveAvatarUri(user?.avatar_url),
              }}
              style={styles.avatar}
            />
            {!isGuest && (
              <Pressable style={styles.editAvatarBtn} onPress={pickImage}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </Pressable>
            )}
          </View>

          <Text style={styles.userName}>{user?.name || "載入中..."}</Text>
          <Text style={styles.userEmail}>{isGuest ? "訪客模式" : (user?.email || "user@example.com")}</Text>

          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🏆 加入時間 {joinYear}</Text>
            </View>
          </View>
        </View>

        {/* Stats Section - Hide for Guest */}
        {!isGuest && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{petCount}</Text>
              <Text style={styles.statLabel}>毛孩數量</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>紀錄總數</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>照護計畫</Text>
            </View>
          </View>
        )}

        {/* Menu Section */}
        <View style={styles.menuContainer}>
          <Text style={styles.sectionTitle}>帳號設定</Text>

          <Pressable style={[styles.menuItem, isGuest && { opacity: 0.5 }]} onPress={openEditModal}>
            <View style={[styles.menuIcon, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="person-outline" size={20} color="#4F46E5" />
            </View>
            <Text style={styles.menuText}>編輯個人資料</Text>
            {isGuest ? <Text style={{ fontSize: 12, color: '#999' }}>需登入</Text> : <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />}
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => { }}>
            <View style={[styles.menuIcon, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="notifications-outline" size={20} color="#16A34A" />
            </View>
            <Text style={styles.menuText}>通知設定</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={() => { }}>
            <View style={[styles.menuIcon, { backgroundColor: '#FFF7ED' }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#EA580C" />
            </View>
            <Text style={styles.menuText}>隱私權與安全性</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>其他</Text>

          <Pressable style={styles.menuItem} onPress={() => Alert.alert("毛很多", "版本 v1.0.0\nMade with ❤️")}>
            <View style={[styles.menuIcon, { backgroundColor: '#F3F4F6' }]}>
              <Ionicons name="information-circle-outline" size={20} color="#4B5563" />
            </View>
            <Text style={styles.menuText}>關於 毛很多</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          {/* Logout / Login Button */}
          <Pressable style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleLogout}>
            <View style={[styles.menuIcon, { backgroundColor: isGuest ? '#E0F2FE' : '#FEF2F2' }]}>
              <Ionicons name={isGuest ? "log-in-outline" : "log-out-outline"} size={20} color={isGuest ? "#0284C7" : "#EF4444"} />
            </View>
            <Text style={[styles.menuText, { color: isGuest ? '#0284C7' : '#EF4444' }]}>
              {isGuest ? "登入 / 註冊會員" : "登出帳號"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>編輯個人資料</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>暱稱</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="輸入新的暱稱"
              />
            </View>

            <Pressable
              style={[styles.saveBtn, updating && { opacity: 0.7 }]}
              onPress={handleUpdateProfile}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>儲存變更</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fbfaff" },

  // Background Bubbles
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
  bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
  b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
  b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
  b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },

  headerCard: {
    margin: 20,
    marginTop: 60,
    padding: 24,
    borderRadius: 24,
    backgroundColor: "rgba(235,227,255,.65)", // Glass effect
    borderWidth: 1,
    borderColor: "rgba(98,62,255,.12)",
    alignItems: 'center',
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFF',
  },
  editAvatarBtn: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#4F46E5',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F1F2A',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B6B7A',
    marginBottom: 16,
    fontWeight: '600'
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(98,62,255,.1)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },

  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    justifyContent: 'space-between',
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1F2A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B6B7A',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#F3F4F6',
  },

  menuContainer: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F1F2A',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F1F2A',
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F1F2A',
  },
  saveBtn: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
