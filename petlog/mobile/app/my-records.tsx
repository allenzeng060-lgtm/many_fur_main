import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, Image, Pressable, SafeAreaView, Platform, ActivityIndicator, Alert, Animated } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { API_URL } from "@/app/config";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

// Mock User ID for now
const CURRENT_USER_ID = "user_002";

export default function MyRecordsScreen() {
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Dynamic User ID Logic
    const fetchMyReports = async () => {
        try {
            setLoading(true);
            let targetUserId = CURRENT_USER_ID; // Default Fallback

            // 1. Try to get actual User ID from storage
            // Note: This logic duplicates what's in other screens. ideally this should be a context/hook.
            try {
                const token = await AsyncStorage.getItem("auth_token");
                if (token === "guest_token") {
                    targetUserId = "guest";
                } else {
                    const userInfoStr = await AsyncStorage.getItem("user_info");
                    if (userInfoStr) {
                        const userInfo = JSON.parse(userInfoStr);
                        targetUserId = String(userInfo.id);
                    }
                }
            } catch (e) {
                console.log("Error loading user info", e);
            }

            console.log("Fetching records for user:", targetUserId);

            // Fetch both Lost and Found reports for this user
            const [lostRes, foundRes] = await Promise.all([
                fetch(`${API_URL}/api/reports?type=lost&user_id=${targetUserId}`),
                fetch(`${API_URL}/api/reports?type=found&user_id=${targetUserId}`)
            ]);

            const lostData = await lostRes.json();
            const foundData = await foundRes.json();

            // Merge and sort by creation date (newest first)
            const allReports = [...(Array.isArray(lostData) ? lostData : []), ...(Array.isArray(foundData) ? foundData : [])].sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setReports(allReports);
        } catch (error) {
            console.error("Error fetching my records:", error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchMyReports();
        }, [])
    );

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>, item: any) => {
        const trans = dragX.interpolate({
            inputRange: [-160, 0],
            outputRange: [1, 0],
            extrapolate: 'clamp',
        });

        return (
            <View style={styles.rightActionsContainer}>
                {/* Edit Action */}
                <RectButton
                    style={[styles.rightAction, styles.editAction]}
                    onPress={() => {
                        const targetPath = item.type === 'lost' ? '/report-lost' : '/report-found';
                        router.push({ pathname: targetPath, params: { id: item.id } });
                    }}>
                    <Ionicons name="pencil" size={24} color="#FFF" />
                    <Text style={styles.actionText}>編輯</Text>
                </RectButton>

                {/* Delete Action */}
                <RectButton
                    style={[styles.rightAction, styles.deleteAction]}
                    onPress={() => {
                        Alert.alert('確認刪除', '確定要刪除這筆紀錄嗎？', [
                            { text: '取消', style: 'cancel' },
                            {
                                text: '刪除',
                                style: 'destructive',
                                onPress: async () => {
                                    try {
                                        const res = await fetch(`${API_URL}/api/reports/${item.id}`, { method: 'DELETE' });
                                        if (res.ok) {
                                            fetchMyReports(); // Refresh list
                                        } else {
                                            Alert.alert('失敗', '刪除失敗');
                                        }
                                    } catch (err) {
                                        console.error(err);
                                        Alert.alert('錯誤', '網路錯誤');
                                    }
                                }
                            }
                        ]);
                    }}>
                    <Ionicons name="trash" size={24} color="#FFF" />
                    <Text style={styles.actionText}>刪除</Text>
                </RectButton>
            </View>
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const isLost = item.type === 'lost';
        const borderColor = isLost ? '#FF6B6B' : '#4ECDC4';
        const label = isLost ? '報失 (My Lost)' : '通報 (I Found)';
        const labelColor = isLost ? '#D32F2F' : '#00796B';
        const bgColor = isLost ? '#FFEBEE' : '#E0F2F1';

        return (
            <View style={styles.itemContainer}>
                <Swipeable renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item)}>
                    <Pressable
                        style={[styles.card, { borderColor: borderColor, borderLeftWidth: 6 }]}
                        onPress={() => router.push({ pathname: '/report-detail', params: { id: item.id, type: item.type } })}
                    >
                        <Image
                            source={{ uri: item.image_path ? `${API_URL}/${item.image_path}`.replace(/\\/g, '/') : 'https://via.placeholder.com/150' }}
                            style={styles.image}
                        />
                        <View style={styles.cardContent}>
                            <View style={styles.headerRow}>
                                <View style={[styles.badge, { backgroundColor: bgColor }]}>
                                    <Text style={[styles.badgeText, { color: labelColor }]}>{label}</Text>
                                </View>
                                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>

                            <Text style={styles.title} numberOfLines={1}>
                                {item.species} {item.breed ? `• ${item.breed}` : ''}
                            </Text>

                            {/* Show Name for Lost Pets */}
                            {isLost && item.name ? (
                                <Text style={styles.nameText}>名字: {item.name}</Text>
                            ) : null}

                            <Text style={styles.location} numberOfLines={1}>
                                <IconSymbol name="location.fill" size={12} color="#666" /> {item.last_seen_location || "未知地點"}
                            </Text>

                            <Text style={[styles.status, { color: item.status === 'resolved' ? '#4CAF50' : '#888' }]}>
                                {item.status === 'resolved' ? '✅ 已結案 (Closed)' : '⏳ 協尋中 (Active)'}
                            </Text>
                        </View>
                    </Pressable>
                </Swipeable>
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
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#1F1F2A" />
                    </Pressable>
                    <Text style={styles.headerTitle}>我的紀錄</Text>
                    <View style={{ width: 40 }} />
                </View>

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#4ECDC4" />
                    </View>
                ) : (
                    <FlatList
                        data={reports}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.center}>
                                <Text style={styles.emptyText}>目前沒有紀錄</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fbfaff" }, // Theme BG

    // Background Bubbles
    bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
    bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
    b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
    b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
    b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },
    b4: { width: 200, height: 200, right: 20, bottom: 100, backgroundColor: "#e2f6ff" },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        backgroundColor: 'transparent', // Transparent header
    },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#1F1F2A' },
    backBtn: { padding: 8, backgroundColor: '#FFF', borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }, // Styled back button

    listContent: { padding: 16, paddingBottom: 80 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },

    // Item Container handles spacing between items
    itemContainer: {
        marginBottom: 16,
        borderRadius: 20, // More rounded
        backgroundColor: 'white',
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 }, // Deeper shadow
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 16, // More padding
        alignItems: 'flex-start',
    },
    image: {
        width: 80,
        height: 80,
        borderRadius: 16, // More rounded
        backgroundColor: '#eee',
        marginRight: 16,
    },
    cardContent: {
        flex: 1,
        justifyContent: 'flex-start',
        gap: 6,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    date: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '500'
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1F2937',
    },
    nameText: {
        fontSize: 15,
        color: '#4B5563',
        fontWeight: '600',
    },
    location: {
        fontSize: 13,
        color: '#6B7280',
    },
    status: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
    },

    // Swipe Actions
    rightActionsContainer: {
        width: 160, // Wider for better touch area
        flexDirection: 'row',
    },
    rightAction: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editAction: {
        backgroundColor: '#9CA3AF',
    },
    deleteAction: {
        backgroundColor: '#EF4444',
    },
    actionText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 18,
        fontWeight: '600'
    }
});
