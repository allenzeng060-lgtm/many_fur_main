import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const QUICK_STEPS = [
  { icon: 'camera-outline', title: '拍一張清楚照片', desc: '毛孩正面、光線充足效果最好' },
  { icon: 'sparkles-outline', title: '選擇個性風格', desc: '傲嬌、呆萌、優雅都可以試試' },
  { icon: 'chatbubble-ellipses-outline', title: '立即獲得心聲', desc: 'AI 會生成一句毛孩內心 OS' },
];

const PREVIEW_LINES = [
  '「罐罐時間到了嗎？」',
  '「我剛剛其實在等你回家。」',
  '「先摸摸我，再忙你的事。」',
];

export default function MindScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#F3E8FF', '#FFFFFF']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>

          <Text style={styles.headerTitle}>寵物讀心術 🔮</Text>
          <Text style={styles.headerSubtitle}>看看毛孩在想什麼？</Text>

          {/* Primary Feature Card */}
          <View style={styles.primaryCard}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <View style={styles.primaryBadge}>
                <Ionicons name="sparkles" size={14} color="#F5F3FF" />
                <Text style={styles.primaryBadgeText}>主要功能</Text>
              </View>

              <Text style={styles.primaryTitle}>AI 智能辨識</Text>
              <Text style={styles.primaryDesc}>
                拍照或上傳照片，快速辨識寵物品種與特徵
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryActionBtn,
                  pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }
                ]}
                onPress={() => router.push("/camera")}
              >
                <Ionicons name="camera" size={24} color="#7C3AED" />
                <Text style={styles.primaryActionText}>開始辨識</Text>
                <Ionicons name="arrow-forward" size={20} color="#7C3AED" />
              </Pressable>

              <View style={styles.quickHintRow}>
                <View style={styles.quickHintChip}>
                  <Ionicons name="flash" size={12} color="#FFF" />
                  <Text style={styles.quickHintText}>快速</Text>
                </View>
                <View style={styles.quickHintChip}>
                  <Ionicons name="images" size={12} color="#FFF" />
                  <Text style={styles.quickHintText}>相簿/拍照</Text>
                </View>
                <View style={styles.quickHintChip}>
                  <Ionicons name="paw" size={12} color="#FFF" />
                  <Text style={styles.quickHintText}>毛孩特徵</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoHeaderRow}>
              <Ionicons name="rocket-outline" size={18} color="#7C3AED" />
              <Text style={styles.infoTitle}>快速上手</Text>
            </View>
            {QUICK_STEPS.map((step) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={step.icon as any} size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.previewCard}>
            <View style={styles.infoHeaderRow}>
              <Ionicons name="happy-outline" size={18} color="#7C3AED" />
              <Text style={styles.infoTitle}>靈感預覽</Text>
            </View>
            {PREVIEW_LINES.map((line) => (
              <View key={line} style={styles.previewBubble}>
                <Text style={styles.previewText}>{line}</Text>
              </View>
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 18 },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#4C1D95',
    marginBottom: 8,
    textAlign: 'center',
    marginTop: 18
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 30
  },

  primaryCard: {
    borderRadius: 28,
    marginBottom: 28,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 9,
    backgroundColor: 'white'
  },
  primaryGradient: {
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 30,
    minHeight: 340,
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 14,
    gap: 5
  },
  primaryBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700'
  },
  primaryTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12
  },
  primaryDesc: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 27,
    marginBottom: 22
  },
  primaryActionBtn: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  primaryActionText: {
    color: '#7C3AED',
    fontSize: 21,
    fontWeight: '800'
  },
  quickHintRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  quickHintChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  quickHintText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600'
  },

  infoCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    padding: 16,
    marginBottom: 14,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4C1D95'
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12
  },
  stepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937'
  },
  stepDesc: {
    marginTop: 2,
    fontSize: 13,
    color: '#6B7280'
  },
  previewCard: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
    padding: 16,
    marginBottom: 28,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2
  },
  previewBubble: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8
  },
  previewText: {
    fontSize: 14,
    color: '#5B21B6',
    fontWeight: '600'
  },
});
