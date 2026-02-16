import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Platform, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function ModalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const imageRef = useRef<View>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  const imageUri = Array.isArray(params.imageUri) ? params.imageUri[0] : params.imageUri;
  const analysis = Array.isArray(params.analysis) ? params.analysis[0] : params.analysis;
  const displayText = analysis || "（正在讀取腦波...）\n本汪/本喵現在只想吃罐罐！";

  const handleClose = () => router.back();

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (permissionResponse?.status !== 'granted') {
        const { status } = await requestPermission();
        if (status !== 'granted') {
          Alert.alert("權限不足", "需要相簿權限才能保存照片喔！");
          setIsSaving(false);
          return;
        }
      }
      // 擷取時要包含背景嗎？這裡只擷取拍立得卡片部分
      const localUri = await captureRef(imageRef, { height: 0, quality: 1, format: "png" });
      await MediaLibrary.saveToLibraryAsync(localUri);
      Alert.alert("保存成功", "這張讀心日記已經存到你的相簿囉！", [{ text: "好棒", onPress: () => router.back() }]);
    } catch (e) {
      console.error(e);
      Alert.alert("保存失敗", "發生了一點小錯誤");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* 背景光暈 (複製自 Home Screen) */}
      <View pointerEvents="none" style={styles.bg}>
        <View style={[styles.bubble, styles.b1]} />
        <View style={[styles.bubble, styles.b2]} />
        <View style={[styles.bubble, styles.b3]} />
      </View>

      {/* 截圖區域：設計成一張拍立得卡片風格 */}
      <View style={styles.centerArea}>
        <View ref={imageRef} style={styles.polaroidCard} collapsable={false}>
          {/* 照片區 */}
          <View style={styles.imageFrame}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.placeholder]}><Text style={styles.placeholderText}>No Image</Text></View>
            )}
          </View>

          {/* 漫畫氣泡區 - 重疊在照片上 */}
          <View style={styles.bubbleOverlay}>
            <View style={styles.bubbleBody}>
              <View style={styles.bubbleHeader}>
                <MaterialIcons name="auto-awesome" size={16} color="#623eff" />
                <Text style={styles.aiLabel}>AI 讀心日記</Text>
              </View>
              <Text style={styles.thoughtText}>{displayText}</Text>
              <Text style={styles.dateLabel}>{new Date().toLocaleDateString()}</Text>
            </View>
            {/* 氣泡尾巴 */}
            <View style={styles.bubbleTail} />
          </View>
        </View>
      </View>

      {/* 關閉按鈕 */}
      <Pressable onPress={handleClose} style={styles.closeButton}>
        <MaterialIcons name="close" size={20} color="#1f1f2a" />
      </Pressable>

      {/* 底部按鈕 */}
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, pressed && styles.saveBtnPressed]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator color="#FFF" /> : (
            <>
              <MaterialIcons name="save-alt" size={20} color="#FFF" />
              <Text style={styles.saveBtnText}>保存日記</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfaff' },

  // Background Bubbles
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
  bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
  b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
  b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
  b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },

  // 居中顯示卡片
  centerArea: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  // 拍立得風格卡片
  polaroidCard: {
    width: width - 48,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 16,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#623eff', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10
  },
  imageFrame: {
    width: '100%',
    height: width - 80, // 讓照片接近正方形
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f2f2f5',
    marginBottom: -24, // 讓氣泡往上蓋
  },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f5' },
  placeholderText: { color: '#999' },

  // 氣泡樣式
  bubbleOverlay: { width: '92%', alignItems: 'center' },
  bubbleBody: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    width: '100%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  bubbleTail: {
    width: 24, height: 24, backgroundColor: '#FFF',
    transform: [{ rotate: '45deg' }],
    marginTop: -12, // 讓尾巴縮進去一點
    zIndex: -1,
    elevation: 4,
  },

  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  aiLabel: { fontSize: 13, fontWeight: '800', color: '#623eff', letterSpacing: 0.5 },
  thoughtText: { fontSize: 18, lineHeight: 28, color: '#1f1f2a', fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'PingFang TC' : 'sans-serif' },
  dateLabel: { marginTop: 12, fontSize: 12, color: '#9ca3af', textAlign: 'right', fontWeight: '500' },

  // UI Controls
  closeButton: {
    position: 'absolute', top: 60, right: 24,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    zIndex: 100
  },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 50, paddingTop: 20,
    alignItems: 'center',
    zIndex: 100
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1f1f2a', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 32,
    shadowColor: '#1f1f2a', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6
  },
  saveBtnPressed: { transform: [{ scale: 0.96 }] },
  saveBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
});
