import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, SafeAreaView, Platform, Dimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import LostPetList from "@/components/LostPetList";
import FoundPetList from "@/components/FoundPetList";

const { width } = Dimensions.get('window');

export default function PetLobbyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [mode, setMode] = useState<'lost' | 'found'>('lost');

  // React to parameter changes to switch tabs automatically
  React.useEffect(() => {
    if (params.initialMode === 'found') {
      setMode('found');
    } else if (params.initialMode === 'lost') {
      setMode('lost');
    }
  }, [params.initialMode]);

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
        {/* Header with Segmented Control */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>寵物大廳</Text>

          <View style={styles.segmentContainer}>
            <Pressable
              style={[styles.segmentBtn, mode === 'lost' && styles.segmentBtnActive]}
              onPress={() => setMode('lost')}
            >
              <Text style={[styles.segmentText, mode === 'lost' && styles.segmentTextActive]}>
                🚨 走失通報
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, mode === 'found' && styles.segmentBtnActive]}
              onPress={() => setMode('found')}
            >
              <Text style={[styles.segmentText, mode === 'found' && styles.segmentTextActive]}>
                🏠 尋獲通報
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Main Content Area */}
        <View style={styles.content}>
          {mode === 'lost' ? <LostPetList /> : <FoundPetList />}
        </View>

        {/* Floating Action Buttons */}
        {/* My Records FAB (Bottom Left) */}
        <Pressable
          style={[styles.fab, styles.fabLeft]}
          onPress={() => router.push('/my-records')}
        >
          <IconSymbol name="list.bullet.clipboard" size={24} color="white" />
          <Text style={styles.fabText}>紀錄</Text>
        </Pressable>

        {/* Dynamic Report FAB (Bottom Right) */}
        {mode === 'lost' ? (
          <Pressable
            style={[styles.fab, styles.fabRight]}
            onPress={() => router.push('/report-lost')}
          >
            <IconSymbol name="exclamationmark.triangle.fill" size={24} color="white" />
            <Text style={styles.fabText}>報失</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.fab, styles.fabRight, { backgroundColor: '#4ECDC4' }]} // Teal for Found
            onPress={() => router.push('/report-found')}
          >
            <IconSymbol name="camera.viewfinder" size={24} color="white" />
            <Text style={styles.fabText}>通報</Text>
          </Pressable>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fbfaff" }, // Use theme bg color

  // Background Bubbles
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
  bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
  b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
  b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
  b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },
  b4: { width: 200, height: 200, right: 20, bottom: 100, backgroundColor: "#e2f6ff" },

  header: { padding: 16, backgroundColor: 'transparent', paddingTop: Platform.OS === 'android' ? 40 : 10 }, // Transparent header
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#1F1F2A', marginBottom: 16, textAlign: 'left', letterSpacing: -0.5, paddingHorizontal: 4 }, // Match Home Title Style

  segmentContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, padding: 4, borderWidth: 1, borderColor: '#fff' }, // Glassy segment
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  segmentBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  segmentText: { fontWeight: '600', color: '#888', fontSize: 14 },
  segmentTextActive: { color: '#1F1F2A', fontWeight: '800' },

  content: { flex: 1 },

  fab: {
    position: 'absolute',
    bottom: 30,
    width: 65,
    height: 65,
    borderRadius: 35,
    backgroundColor: '#FF6B6B', // Default Red
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  fabLeft: { left: 30, backgroundColor: '#7E57C2' }, // Purple for Records
  fabRight: { right: 30 },
  fabText: { color: 'white', fontSize: 10, fontWeight: '900', marginTop: 2 },
});
