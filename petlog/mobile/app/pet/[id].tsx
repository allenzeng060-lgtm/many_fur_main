import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  StatusBar,
  Image,
  Modal,
  Dimensions,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { api } from "../../utils/api";
import { LineChart } from "react-native-gifted-charts";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '@/app/config';

type Pet = {
  id: number;
  name: string;
  species?: string | null;
  breed?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  avatar_url?: string | null;
};

type EventItem = {
  id: number;
  type: string;
  title?: string;
  note?: string;
  happened_at: string;
  images?: string[];
  value?: any;
};

type CarePlan = {
  id: number;
  name: string;
  interval_days: number;
  last_date?: string;
};

function label(t: string) {
  switch (t) {
    case "weight": return "體重";
    case "vaccine": return "疫苗";
    case "visit": return "看診";
    case "med": return "用藥";
    case "note": return "筆記";
    default: return t;
  }
}

function getIcon(t: string) {
  switch (t) {
    case "weight": return "scale-outline";
    case "vaccine": return "medkit-outline";
    case "visit": return "medical-outline";
    case "med": return "bandage-outline";
    case "note": return "document-text-outline";
    default: return "ellipse-outline";
  }
}

export default function PetDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const petId = useMemo(() => Number(params.id), [params.id]);

  const [pet, setPet] = useState<Pet | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'timeline' | 'health'>('timeline');

  // Image Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const petAvatarUrl = useMemo(() => {
    if (!pet?.avatar_url) return null;
    return pet.avatar_url.startsWith('http') ? pet.avatar_url : `${API_URL}${pet.avatar_url}`;
  }, [pet?.avatar_url]);

  const loadAll = useCallback(async () => {
    try {
      const p = await api.get(`/pets/${petId}`);
      setPet(p && typeof p === "object" ? p : null);

      const list = await api.get(`/pets/${petId}/events`);
      setEvents(Array.isArray(list) ? list : []);

      const plans = await api.get(`/pets/${petId}/care-plans`);
      setCarePlans(Array.isArray(plans) ? plans : []);
    } catch (e: any) {
      if (e.message !== "Unauthorized") Alert.alert("載入失敗", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [petId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleDeleteEvent = (ev: EventItem) => {
    Alert.alert("刪除紀錄", "確定要刪除這筆紀錄嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/events/${ev.id}`);
            await onRefresh();
          } catch (e: any) {
            Alert.alert("刪除失敗", e?.message || String(e));
          }
        },
      },
    ]);
  };

  const openImage = (url: string) => {
    setSelectedImage(url);
    setModalVisible(true);
  };


  const openAvatarOptions = () => {
    Alert.alert('更換照片', '請選擇來源', [
      { text: '拍照', onPress: () => pickPetAvatar(true) },
      { text: '從相簿選擇', onPress: () => pickPetAvatar(false) },
      { text: '取消', style: 'cancel' }
    ]);
  };

  const pickPetAvatar = async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('權限不足', '需要相機權限來拍照');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7
        });
        const didCancel = 'canceled' in result ? result.canceled : (result as any).cancelled;
        const uri = result.assets?.[0]?.uri ?? (result as any).uri;
        if (!didCancel && uri) await uploadPetAvatar(uri);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('權限不足', '需要相簿權限來選擇照片');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7
        });
        const didCancel = 'canceled' in result ? result.canceled : (result as any).cancelled;
        const uri = result.assets?.[0]?.uri ?? (result as any).uri;
        if (!didCancel && uri) await uploadPetAvatar(uri);
      }
    } catch (e: any) {
      Alert.alert('錯誤', e?.message || String(e));
    }
  };

  const uploadPetAvatar = async (uri: string) => {
    setAvatarUploading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const form = new FormData();
      // @ts-ignore - React Native FormData file
      form.append('file', { uri, name: 'pet-avatar.jpg', type: 'image/jpeg' });

      const uploadRes = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form as any,
      });

      if (!uploadRes.ok) {
        const txt = await uploadRes.text();
        throw new Error(txt || '圖片上傳失敗');
      }
      const body = await uploadRes.json();
      const avatar_url = body.url;

      const updatedPet = await api.patch(`/pets/${petId}`, { avatar_url });
      if (updatedPet && typeof updatedPet === "object") {
        setPet(updatedPet);
      } else {
        setPet(prev => (prev ? { ...prev, avatar_url } : prev));
      }
      Alert.alert('成功', '照片已更新');
    } catch (e: any) {
      Alert.alert('上傳失敗', e?.message || String(e));
    } finally {
      setAvatarUploading(false);
    }
  };

  const generatePDF = async () => {
    if (!pet) return;
    setExporting(true);
    try {
      const html = `
            <html>
              <head>
                <style>
                  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
                  h1 { color: #1F1F2A; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
                  h2 { color: #4F46E5; margin-top: 30px; }
                  .pet-info { margin-bottom: 20px; background: #EEF2FF; padding: 15px; border-radius: 10px; }
                  .pet-info p { margin: 5px 0; font-size: 16px; font-weight: bold; }
                  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                  th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                  th { background-color: #F3F4F6; color: #374151; }
                  tr:nth-child(even) { background-color: #F9FAFB; }
                  .tag { background: #E0E7FF; color: #3730A3; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
                </style>
              </head>
              <body>
                <h1>${pet.name} 的健康照護紀錄</h1>
                <div class="pet-info">
                  <p>品種: ${pet.breed || '未知'}</p>
                  <p>性別: ${pet.sex === 'M' ? '男生' : pet.sex === 'F' ? '女生' : '未知'}</p>
                  <p>生日: ${pet.birth_date || '未設定'}</p>
                </div>

                <h2>疫苗與醫療紀錄</h2>
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>類型</th>
                      <th>標題</th>
                      <th>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${events.map(ev => `
                      <tr>
                        <td>${new Date(ev.happened_at).toLocaleDateString('zh-TW')}</td>
                        <td><span class="tag">${label(ev.type)}</span></td>
                        <td>${ev.title || '-'}</td>
                        <td>${ev.note || ''} ${ev.value?.value ? `(${ev.value.value} kg)` : ''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
                 <p style="text-align: center; margin-top: 50px; color: #999;">Generated by PetLog App</p>
              </body>
            </html>
          `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (e: any) {
      Alert.alert("匯出失敗", String(e));
    } finally {
      setExporting(false);
    }
  };

  /**
   * Health Chart Data Preparation
   */
  const weightData = useMemo(() => {
    // Filter weight events
    const wEvents = events
      .filter(e => e.type === 'weight' && e.value?.value)
      .sort((a, b) => new Date(a.happened_at).getTime() - new Date(b.happened_at).getTime());

    // Transform for Gifted Charts
    return wEvents.map(e => ({
      value: parseFloat(e.value.value),
      label: new Date(e.happened_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }),
      dataPointText: e.value.value
    }));
  }, [events]);


  const renderItem = ({ item }: { item: EventItem }) => {
    const title = item.title || label(item.type);
    const date = new Date(item.happened_at).toLocaleDateString('zh-TW');
    const iconName = getIcon(item.type);

    return (
      <View style={styles.evCard}>
        <View style={styles.evIconContainer}>
          <Ionicons name={iconName as any} size={20} color="#4F46E5" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.evTop}>
            <Text style={styles.evTitle}>{title}</Text>
            <Text style={styles.evDate}>{date}</Text>
          </View>
          {!!item.note && <Text style={styles.evNote}>{item.note}</Text>}
          {item.type === 'weight' && item.value?.value && (
            <Text style={styles.evValue}>{item.value.value} kg</Text>
          )}

          {/* Photos */}
          {item.images && item.images.length > 0 && (
            <View style={styles.photosRow}>
              {item.images.map((img, idx) => (
                <Pressable key={idx} onPress={() => openImage(`${API_URL}${img}`)}>
                  <Image source={{ uri: `${API_URL}${img}` }} style={styles.photoThumb} />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.evDelBtn} onPress={() => handleDeleteEvent(item)}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Bubbles */}
      <View pointerEvents="none" style={styles.bg}>
        <View style={[styles.bubble, styles.b1]} />
        <View style={[styles.bubble, styles.b2]} />
        <View style={[styles.bubble, styles.b3]} />
        <View style={[styles.bubble, styles.b4]} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </Pressable>
          <Text style={styles.headerTitle}>寵物詳情</Text>
          <Pressable onPress={generatePDF} style={styles.exportBtn}>
            {exporting ? <ActivityIndicator color="#4F46E5" /> : <Ionicons name="share-outline" size={24} color="#333" />}
          </Pressable>
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {loading && !refreshing && !pet ? (
            <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#4F46E5" />
            </View>
          ) : (
            <>
              {/* Pet Header Card */}
              <View style={styles.petCard}>
                <View style={styles.petAvatarConfig}>
                  <View style={[styles.petAvatar, { backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center' }]}>
                    {petAvatarUrl ? (
                      <Image source={{ uri: petAvatarUrl }} style={styles.petAvatarImage} />
                    ) : (
                      <Ionicons name="paw" size={40} color="#4F46E5" />
                    )}
                  </View>
                  <Pressable
                    style={[styles.cameraBtn, avatarUploading && { opacity: 0.7 }]}
                    onPress={openAvatarOptions}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="camera" size={16} color="white" />
                    )}
                  </Pressable>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.petHeaderInfo}>
                    <Text style={styles.petName}>{pet?.name || '無名氏'}</Text>
                    <View style={styles.genderTag}>
                      <Ionicons name={pet?.sex === 'F' ? "female" : "male"} size={12} color={pet?.sex === 'F' ? "#FF6B6B" : "#4ECDC4"} />
                      <Text style={[styles.genderText, { color: pet?.sex === 'F' ? "#FF6B6B" : "#4ECDC4" }]}>
                        {pet?.sex === 'F' ? '女生' : '男生'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.petDetailText}>{pet?.breed || '未知品種'}  |  {pet?.birth_date || '阿災'}</Text>
                </View>
              </View>

              {/* Tabs */}
              <View style={styles.tabsContainer}>
                <Pressable onPress={() => setActiveTab('timeline')} style={[styles.tab, activeTab === 'timeline' && styles.activeTab]}>
                  <Text style={[styles.tabText, activeTab === 'timeline' && styles.activeTabText]}>時間軸</Text>
                </Pressable>
                <Pressable onPress={() => setActiveTab('health')} style={[styles.tab, activeTab === 'health' && styles.activeTab]}>
                  <Text style={[styles.tabText, activeTab === 'health' && styles.activeTabText]}>健康數據</Text>
                </Pressable>
              </View>

              {activeTab === 'timeline' ? (
                <View style={{ paddingHorizontal: 20 }}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>照護計畫</Text>
                    <Pressable onPress={() => router.push(`/pet/${petId}/add-care-plan`)}>
                      <Text style={styles.linkText}>＋ 新增</Text>
                    </Pressable>
                  </View>

                  {carePlans.length === 0 ? (
                    <View style={styles.emptyPlanCheck}>
                      <Text style={styles.emptyTextSmall}>尚無照護計畫</Text>
                    </View>
                  ) : (
                    carePlans.map(plan => (
                      <View key={plan.id} style={styles.planCard}>
                        <View style={[styles.evIconContainer, { backgroundColor: '#ECFDF5' }]}>
                          <Ionicons name="calendar-outline" size={20} color="#10B981" />
                        </View>
                        <View>
                          <Text style={styles.evTitle}>{plan.name}</Text>
                          <Text style={styles.evNote}>每 {plan.interval_days} 天一次</Text>
                        </View>
                      </View>
                    ))
                  )}

                  <Text style={[styles.sectionTitle, { marginTop: 24, marginBottom: 12 }]}>歷史紀錄</Text>

                  <FlatList
                    data={events}
                    keyExtractor={(e) => String(e.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={false}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>
                          {loading ? "載入中…" : "尚無紀錄，點擊右上方「＋」\n開始記錄生活點滴！"}
                        </Text>
                      </View>
                    }
                  />
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                  <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>體重變化 (kg)</Text>
                    {weightData.length > 0 ? (
                      <View style={{ overflow: 'hidden', paddingRight: 20 }}>
                        <LineChart
                          data={weightData}
                          color="#4F46E5"
                          thickness={3}
                          dataPointsColor="#4F46E5"
                          startFillColor="rgba(79, 70, 229, 0.3)"
                          endFillColor="rgba(79, 70, 229, 0.01)"
                          startOpacity={0.9}
                          endOpacity={0.2}
                          initialSpacing={20}
                          noOfSections={4}
                          yAxisColor="lightgray"
                          xAxisColor="lightgray"
                          yAxisTextStyle={{ color: 'gray' }}
                          width={Dimensions.get('window').width - 80}
                          height={220}
                          curved
                          isAnimated
                        />
                      </View>
                    ) : (
                      <View style={styles.emptyChart}>
                        <Text style={styles.emptyTextSmall}>尚無體重紀錄，快去新增一筆吧！</Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Full Screen Image Modal */}
      <Modal visible={modalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalClose} onPress={() => setModalVisible(false)}>
            <Ionicons name="close" size={32} color="#FFF" />
          </Pressable>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />}
        </View>
      </Modal>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => router.push(`/pet/${petId}/add-event`)}>
        <Ionicons name="add" size={30} color="white" />
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fbfaff',
  },
  // Background Bubbles
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fbfaff',
  },
  bubble: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.28,
  },
  b1: {
    width: 320,
    height: 320,
    left: -100,
    top: -50,
    backgroundColor: '#e9dfff',
  },
  b2: {
    width: 220,
    height: 220,
    right: -50,
    top: 100,
    backgroundColor: '#ffd6e6',
  },
  b3: {
    width: 260,
    height: 260,
    left: 40,
    bottom: -50,
    backgroundColor: '#e7e2ff',
  },
  b4: {
    width: 200,
    height: 200,
    right: 20,
    bottom: 100,
    backgroundColor: '#e2f6ff',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1F1F2A',
  },
  backBtn: {
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  exportBtn: {
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },

  petCard: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center'
  },
  petAvatarConfig: {
    position: 'relative',
    marginRight: 20
  },
  petAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF'
  },
  petAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4ECDC4',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white'
  },
  petHeaderInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  petName: { fontSize: 24, fontWeight: '900', color: '#1F1F2A', marginRight: 10 },
  genderTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4
  },
  genderText: { fontSize: 12, fontWeight: 'bold' },
  petDetailText: { fontSize: 14, color: '#666' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#4F46E5',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 12,
    marginBottom: 20
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#FFF',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280'
  },
  activeTabText: {
    color: '#4F46E5',
    fontWeight: '800'
  },

  bodyContent: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 10
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1F1F2A'
  },
  linkText: {
    color: '#4F46E5',
    fontWeight: '900',
    fontSize: 14
  },
  planCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,1)"
  },
  evCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,1)"
  },
  evIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  evTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  evTitle: { fontSize: 16, fontWeight: "900", color: "#1F2937" },
  evDate: { fontSize: 12, color: "#9CA3AF" },
  evNote: { color: "#6B7280", fontSize: 14, lineHeight: 20, marginBottom: 8 },
  evValue: { fontSize: 16, fontWeight: '800', color: '#4F46E5', marginTop: 4 },

  photosRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  photoThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#E5E7EB' },

  evDelBtn: {
    padding: 8,
    marginLeft: 8
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    marginTop: 16,
    color: '#9CA3AF',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyPlanCheck: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  emptyTextSmall: {
    color: '#9CA3AF',
    fontSize: 14
  },

  // Charts
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4
  },
  chartTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#1F1F2A' },
  emptyChart: { height: 200, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 30, zIndex: 10, padding: 10 },
  fullImage: { width: '100%', height: '80%' }
});
