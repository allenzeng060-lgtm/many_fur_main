import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, StyleSheet, ActivityIndicator, StatusBar, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, API_URL } from "../../../utils/api";

const TYPE_LABEL: Record<string, string> = {
  weight: "體重",
  vaccine: "疫苗",
  visit: "看診",
  med: "用藥",
  note: "筆記",
};

const TYPES = ["weight", "vaccine", "visit", "med", "note"] as const;

// 你的後端 URL，上傳圖片用
// 注意：Android Emulator 請用 10.0.2.2，實機請用 LAN IP
// const API_URL = "http://127.0.0.1:8000"; // Removed local constant

export default function AddEventScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const petId = Number(id);

  const [type, setType] = useState<(typeof TYPES)[number]>("weight");
  const [happenedAt, setHappenedAt] = useState(() => new Date().toISOString().replace("Z", "+08:00"));
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setNow = () => {
    // 台北時間 ISO (+08:00)
    const d = new Date();
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce((acc: any, p) => {
        acc[p.type] = p.value;
        return acc;
      }, {});
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    setHappenedAt(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${ms}+08:00`);
  };

  const pickImage = () => {
    Alert.alert(
      "選擇照片",
      "請選擇來源",
      [
        { text: "拍照", onPress: launchCamera },
        { text: "從相簿", onPress: launchLibrary },
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
      quality: 0.5,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0].uri);
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
      quality: 0.5,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', {
        uri,
        name: 'upload.jpg',
        type: 'image/jpeg',
      });

      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      // data.url should be like "/static/uploads/uuid.jpg"
      setImages(prev => [...prev, data.url]);
    } catch (e: any) {
      Alert.alert("上傳失敗", String(e));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!petId) return;

    setSubmitting(true);
    try {
      const payload: any = {
        type,
        happened_at: happenedAt,
        title: title.trim() || null,
        note: note.trim() || null,
        value: value.trim() ? { value: value.trim() } : null,
        images: images,
      };

      await api.post(`/pets/${petId}/events`, payload);
      router.back();
    } catch (e: any) {
      Alert.alert("新增失敗", String(e?.message || e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Background Bubbles */}
      <View pointerEvents="none" style={styles.bg}>
        <View style={[styles.bubble, styles.b1]} />
        <View style={[styles.bubble, styles.b2]} />
        <View style={[styles.bubble, styles.b3]} />
      </View>

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F1F2A" />
        </Pressable>
        <Text style={styles.headerTitle}>新增紀錄</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>類型</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => {
                const active = t === type;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[styles.typeBtn, active && styles.typeBtnOn]}
                  >
                    <Text style={[styles.typeText, active && styles.typeTextOn]}>
                      {TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>時間 (ISO格式)</Text>
            <TextInput
              value={happenedAt}
              onChangeText={setHappenedAt}
              placeholder="例如：2026-02-09T09:50..."
              style={styles.input}
            />
            <Pressable onPress={setNow} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>使用現在時間</Text>
            </Pressable>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>標題 (選填)</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="例如：打預防針 / 定期回診"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>數值 (選填)</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="例如：4.5 (體重)"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          {/* Image Upload Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>照片紀錄 (選填)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageConfig}>
              {images.map((img, index) => (
                <View key={index} style={styles.imagePreview}>
                  <Image source={{ uri: `${API_URL}${img}` }} style={styles.thumb} />
                  <Pressable style={styles.removeBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={24} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addPhotoBtn} onPress={pickImage} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#4F46E5" /> : <Ionicons name="camera-outline" size={32} color="#4F46E5" />}
                <Text style={styles.addPhotoText}>新增</Text>
              </Pressable>
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>備註 (選填)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="詳細內容..."
              placeholderTextColor="#9CA3AF"
              multiline
              style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
            />
          </View>

          <Pressable style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={submit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>儲存紀錄</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  // Background Bubbles
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
  bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
  b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
  b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
  b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },

  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F1F2A'
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },

  content: { paddingHorizontal: 20, paddingBottom: 40 },

  formCard: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)"
  },
  inputGroup: {
    marginBottom: 20
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937'
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: 'transparent'
  },
  typeBtnOn: {
    backgroundColor: "#1F1F2A",
  },
  typeText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  typeTextOn: { color: '#FFF' },

  smallBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8
  },
  smallBtnText: { fontSize: 12, color: '#4F46E5', fontWeight: '700' },

  // Image Upload Styles
  imageConfig: { gap: 12, paddingVertical: 4 },
  imagePreview: { position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#E5E7EB' },
  removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FFF', borderRadius: 12 },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#C7D2FE',
    borderStyle: 'dashed'
  },
  addPhotoText: { fontSize: 12, color: '#4F46E5', fontWeight: '600', marginTop: 4 },

  submitBtn: {
    marginTop: 12,
    backgroundColor: "#1F1F2A",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  submitText: { color: "white", fontWeight: "900", fontSize: 16 },
});
