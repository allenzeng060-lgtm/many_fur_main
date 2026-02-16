import React, { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  StatusBar,
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { api } from "../utils/api";
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from "../utils/api";

export default function AddPetScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<"cat" | "dog" | "">("");
  const [breed, setBreed] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("提醒", "毛孩名字是必填的喔！");
      return;
    }
    setSaving(true);
    try {
      // If user selected an image, first upload to /upload, then create pet with avatar_url
      let avatar_url: string | undefined = undefined;
      if (imageUri) {
        setUploading(true);
        const token = await AsyncStorage.getItem('auth_token');
        const form = new FormData();
        const uriParts = imageUri.split('/');
        const fileName = uriParts[uriParts.length - 1];
        const file: any = {
          uri: imageUri,
          name: fileName,
          type: 'image/jpeg',
        };
        form.append('file', file as any);

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
        avatar_url = body.url;
      }

      const payload = {
        name: name.trim(),
        species: species ? species : null,
        breed: breed.trim() ? breed.trim() : null,
        ...(avatar_url ? { avatar_url } : {}),
      };
      await api.post("/pets", payload);
      router.back();
    } catch (e: any) {
      Alert.alert("新增失敗", e?.message || String(e));
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const askAndPick = async (fromCamera = false) => {
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('權限不足', '需要相機權限來拍照');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
        const didCancel = 'canceled' in res ? res.canceled : (res as any).cancelled;
        const uri = res.assets?.[0]?.uri ?? (res as any).uri;
        if (!didCancel && uri) setImageUri(uri);
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('權限不足', '需要相簿權限來選擇照片');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
          allowsEditing: true
        });
        const didCancel = 'canceled' in res ? res.canceled : (res as any).cancelled;
        const uri = res.assets?.[0]?.uri ?? (res as any).uri;
        if (!didCancel && uri) setImageUri(uri);
      }
    } catch (err: any) {
      Alert.alert('錯誤', String(err));
    }
  };

  const openImageOptions = () => {
    Alert.alert('加入照片', '請選擇照片來源', [
      { text: '拍照', onPress: () => askAndPick(true) },
      { text: '從相簿選擇', onPress: () => askAndPick(false) },
      { text: '取消', style: 'cancel' }
    ]);
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
        <Text style={styles.headerTitle}>新增毛孩</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.formCard}>
          <View style={styles.avatarRow}>
            <Pressable style={styles.avatarWrap} onPress={openImageOptions}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="paw" size={40} color="#7C3AED" />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </Pressable>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={{ fontWeight: '900', fontSize: 20 }}>{name || '尚未命名'}</Text>
              <Text style={{ color: '#6B7280', marginTop: 4 }}>{species ? species : '物種'}</Text>
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>毛孩名字 <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="例如：米魯 / 奶茶"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>物種</Text>
            <View style={styles.typeRow}>
              <Pressable style={[styles.typeBtn, species === "cat" && styles.typeBtnOn]} onPress={() => setSpecies("cat")}>
                <Text style={[styles.typeText, species === "cat" && styles.typeTextOn]}>🐱 貓咪</Text>
              </Pressable>
              <Pressable style={[styles.typeBtn, species === "dog" && styles.typeBtnOn]} onPress={() => setSpecies("dog")}>
                <Text style={[styles.typeText, species === "dog" && styles.typeTextOn]}>🐶 狗狗</Text>
              </Pressable>
              <Pressable style={[styles.typeBtn, species === "" && styles.typeBtnOn]} onPress={() => setSpecies("")}>
                <Text style={[styles.typeText, species === "" && styles.typeTextOn]}>其他</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>品種 (選填)</Text>
            <TextInput
              style={styles.input}
              value={breed}
              onChangeText={setBreed}
              placeholder="例如：英短 / 柴犬"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <Pressable style={[styles.submitBtn, saving && { opacity: 0.7 }]} onPress={submit} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitText}>建立毛孩資料</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
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
    fontWeight: '900',
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

  content: {
    paddingHorizontal: 20,
  },
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
    borderColor: "rgba(255,255,255,0.6)",
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  avatarWrap: { width: 84, height: 84 },
  avatar: { width: 84, height: 84, borderRadius: 9999 },
  avatarPlaceholder: { width: 84, height: 84, borderRadius: 9999, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 34, height: 34, borderRadius: 20, backgroundColor: '#34D399', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  inputGroup: {
    marginBottom: 24
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8
  },
  required: {
    color: '#EF4444'
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937'
  },
  typeRow: { flexDirection: "row", gap: 12 },
  typeBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  typeBtnOn: { backgroundColor: "#1F1F2A" },
  typeText: { fontWeight: "700", color: "#6B7280", fontSize: 14 },
  typeTextOn: { color: "#FFF" },

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
