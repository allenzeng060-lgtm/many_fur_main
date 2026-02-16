import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator, Alert, Pressable, TextInput, KeyboardAvoidingView, Platform, Linking, Dimensions, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { API_URL } from './config';
import { CURRENT_USER_ID as GLOBAL_USER_ID } from '@/constants/User'; // Added

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState<any[]>([]);

    // Comment Input
    const [newComment, setNewComment] = useState('');
    const [submittingComment, setSubmittingComment] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);

    const { width: screenWidth } = Dimensions.get('window');

    // Mock Current User (for Edit Permission)
    const CURRENT_USER_ID = GLOBAL_USER_ID;

    const fetchReportDetail = async () => {
        try {
            const res = await fetch(`${API_URL}/api/reports/${id}`);
            if (res.ok) {
                const data = await res.json();
                setReport(data);
                fetchComments();
            } else {
                Alert.alert('Error', 'Report not found');
                router.back();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (value: boolean) => {
        const newStatus = value ? 'open' : 'resolved';
        // Optimistic Update
        const oldStatus = report.status;
        setReport((prev: any) => ({ ...prev, status: newStatus }));

        try {
            const formData = new FormData();
            formData.append('status', newStatus);
            // formData.append('user_id', CURRENT_USER_ID); // Ensure user_id is passed if needed for auth simulation

            // Important: React Native fetch handles multipart/form-data boundary automatically if body is FormData
            // BUT for simple updates, x-www-form-urlencoded might be safer if backend uses Form() for everything.
            // Let's stick to FormData as it's standard for `Form()` params in FastAPI.

            const res = await fetch(`${API_URL}/api/reports/${id}`, {
                method: 'PUT',
                body: formData as any
            });

            if (!res.ok) {
                throw new Error("Failed to update status");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to update status");
            setReport((prev: any) => ({ ...prev, status: oldStatus })); // Revert
        }
    };

    const fetchComments = async () => {
        // ... (rest of code)
        try {
            const res = await fetch(`${API_URL}/api/reports/${id}/comments`);
            if (res.ok) {
                const data = await res.json();
                setComments(data);
            }
        } catch (error) {
            console.error("Fetch comments error", error);
        }
    };

    const postComment = async () => {
        if (!newComment.trim()) return;
        setSubmittingComment(true);
        try {
            const res = await fetch(`${API_URL}/api/reports/${id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: "Guest_User", // Mock user
                    content: newComment
                })
            });
            if (res.ok) {
                setNewComment('');
                fetchComments(); // Refresh comments
            }
        } catch (error) {
            Alert.alert("Error", "Failed to post comment");
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleCall = () => {
        if (report?.contact_phone) {
            Linking.openURL(`tel:${report.contact_phone}`);
        } else {
            Alert.alert("Info", "No phone number provided.");
        }
    };

    const handleEdit = () => {
        if (report?.user_id === CURRENT_USER_ID) {
            router.push({
                pathname: report.type === 'lost' ? '/report-lost' : '/report-found',
                params: { id: id } // Pass ID to trigger edit mode
            });
        } else {
            Alert.alert("Permission Denied", "Only the original poster can edit this report.");
        }
    };

    const handleDelete = async () => {
        const doDelete = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/api/reports/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    const msg = "資料已刪除";
                    if (Platform.OS === 'web') {
                        window.alert(msg);
                        router.replace('/(tabs)');
                    } else {
                        Alert.alert("成功", msg, [{ text: "OK", onPress: () => router.replace('/(tabs)') }]);
                    }
                } else {
                    const errText = await res.text();
                    const msg = `刪除失敗: ${res.status} ${errText}`;
                    if (Platform.OS === 'web') window.alert(msg);
                    else Alert.alert("錯誤", msg);
                }
            } catch (e: any) {
                console.error(e);
                const msg = `網路錯誤: ${e.message}`;
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert("錯誤", msg);
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm("您確定要刪除這筆資料嗎？此動作無法復原。")) {
                doDelete();
            }
        } else {
            Alert.alert("確認刪除", "您確定要刪除這筆資料嗎？此動作無法復原。", [
                { text: "取消", style: "cancel" },
                { text: "刪除", style: "destructive", onPress: doDelete }
            ]);
        }
    };

    const handleAIMatch = () => {
        router.push({
            pathname: '/match-results',
            params: { reportId: id }
        });
    };

    useEffect(() => {
        if (id) fetchReportDetail();
    }, [id]);

    if (loading) return <ActivityIndicator size="large" color="#4ECDC4" style={{ flex: 1 }} />;
    if (!report) return null;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
        >
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header / Nav Bar */}
            <View style={styles.navBar}>
                <Pressable onPress={() => router.back()} style={styles.navButton}>
                    <IconSymbol name="chevron.left" size={24} color="#333" />
                </Pressable>
                <Text style={styles.navTitle}>詳細資料</Text>
                <Pressable onPress={() => router.replace('/(tabs)')} style={styles.navButton}>
                    <IconSymbol name="house.fill" size={24} color="#333" />
                </Pressable>
            </View>

            {/* Status Toggle (Owner) or Badge (Viewer) - Moved to Root for Z-Index Safety */}
            <View style={styles.statusContainer}>
                {report.user_id === CURRENT_USER_ID ? (
                    <Pressable
                        onPress={() => toggleStatus(report.status === 'open')} // Toggle current state
                        style={[styles.statusToggle, { backgroundColor: report.status === 'resolved' ? '#E8F5E9' : '#FFF3E0' }]}
                    >
                        <Text style={[styles.statusLabel, { color: report.status === 'resolved' ? '#2E7D32' : '#E65100' }]}>
                            {report.status === 'resolved' ? '🎉 已尋回' : '🔍 協尋中'}
                        </Text>
                        <Switch
                            trackColor={{ false: "#FF9800", true: "#4CAF50" }}
                            thumbColor={"#fff"}
                            ios_backgroundColor="#FF9800"
                            onValueChange={toggleStatus}
                            value={report.status === 'resolved'}
                            style={{ transform: [{ scale: 0.8 }] }} // Slightly smaller to fit pill
                        />
                    </Pressable>
                ) : (
                    report.status === 'resolved' ? (
                        <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
                            <Text style={styles.badgeText}>已尋回</Text>
                        </View>
                    ) : (
                        <View style={[styles.badge, { backgroundColor: '#FFC107' }]}>
                            <Text style={[styles.badgeText, { color: '#333' }]}>協尋中</Text>
                        </View>
                    )
                )}
            </View>

            <ScrollView style={styles.container}>
                {/* Image Carousel & Status */}
                <View style={styles.carouselContainer}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={({ nativeEvent }) => {
                            const slide = Math.ceil(nativeEvent.contentOffset.x / nativeEvent.layoutMeasurement.width);
                            if (slide !== activeSlide) setActiveSlide(slide);
                        }}
                        scrollEventThrottle={16}
                    >
                        {(report.images && report.images.length > 0 ? report.images : (report.image_path ? [{ image_path: report.image_path }] : [])).map((img: any, index: number) => (
                            <Image
                                key={index}
                                source={{ uri: `${API_URL}/${img.image_path}`.replace(/\\/g, '/') }}
                                style={[styles.image, { width: screenWidth }]}
                            />
                        ))}
                    </ScrollView>

                    {/* Pagination Dots */}
                    {(report.images && report.images.length > 1) && (
                        <View style={styles.pagination}>
                            {report.images.map((_: any, i: number) => (
                                <View key={i} style={[styles.dot, i === activeSlide ? styles.activeDot : null]} />
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.contentContainer}>
                    {/* Header: Title */}
                    <View style={styles.headerRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.speciesBig}>{report.species} {report.breed ? `• ${report.breed}` : ''}</Text>
                            <Text style={styles.time}>
                                <IconSymbol name="calendar" size={14} color="#888" /> {new Date(report.lost_time || report.created_at).toLocaleString()}
                            </Text>
                        </View>
                    </View>

                    {/* 1. Basic Info Cards (Icons) */}
                    <View style={styles.infoCardsRow}>
                        {/* Sex */}
                        <View style={styles.infoCard}>
                            <IconSymbol
                                name={report.sex === 'male' ? 'gender.male' : report.sex === 'female' ? 'gender.female' : 'questionmark.circle'}
                                size={24}
                                color={report.sex === 'male' ? '#4A90E2' : report.sex === 'female' ? '#FF6B6B' : '#888'}
                            />
                            <Text style={styles.infoCardText}>{report.sex === 'male' ? '公' : report.sex === 'female' ? '母' : '未知'}</Text>
                        </View>
                        {/* Size */}
                        <View style={styles.infoCard}>
                            <IconSymbol name="ruler" size={24} color="#6C63FF" />
                            <Text style={styles.infoCardText}>{report.size === 'Small' ? '小型' : report.size === 'Medium' ? '中型' : report.size === 'Large' ? '大型' : '未知'}</Text>
                        </View>
                        {/* Age */}
                        <View style={styles.infoCard}>
                            <IconSymbol name="hourglass" size={24} color="#F5A623" />
                            <Text style={styles.infoCardText}>{report.age ? `${report.age} 歲` : '未知'}</Text>
                        </View>
                    </View>

                    {/* AI Analysis (Found only) - Simplified to highlight */}
                    {report.type === 'found' && (
                        <View style={styles.aiHighlight}>
                            <Text style={styles.aiHighlightTitle}>✨ AI 識別特徵</Text>
                            <Text style={styles.aiHighlightText}>
                                {report.features || '無明顯特徵'} • {report.color || '未知毛色'}
                            </Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    {/* 2. Map & Location */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>地點與地圖</Text>
                        <Text style={styles.addressText}>{report.last_seen_location || '未提供詳細地址'} {report.region ? `(${report.region})` : ''}</Text>

                        <Pressable
                            style={styles.mapPreview}
                            onPress={() => {
                                const query = report.lat && report.lng ? `${report.lat},${report.lng}` : report.last_seen_location;
                                const url = Platform.select({
                                    ios: `http://maps.apple.com/?q=${query}`,
                                    android: `geo:0,0?q=${query}`
                                });
                                Linking.openURL(url || `https://www.google.com/maps/search/?api=1&query=${query}`);
                            }}
                        >
                            <View style={styles.mapPlaceholder}>
                                <IconSymbol name="map.fill" size={32} color="#fff" />
                                <Text style={styles.mapText}>開啟地圖查看位置</Text>
                            </View>
                        </Pressable>
                    </View>

                    {/* 3. Description (Conditional) */}
                    {(report.description) ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>詳細描述</Text>
                            <Text style={styles.descriptionText}>{report.description}</Text>
                        </View>
                    ) : null}

                    {/* 4. Contact Button */}
                    <View style={styles.section}>
                        {report.contact_phone ? (
                            <Pressable
                                style={styles.primaryCallBtn}
                                onPress={handleCall}
                            >
                                <IconSymbol name="phone.fill" size={24} color="#fff" />
                                <Text style={styles.primaryCallText}>撥打聯絡電話 ({report.contact_name || '失主'})</Text>
                            </Pressable>
                        ) : (
                            <View style={styles.disabledBtn}>
                                <Text style={styles.disabledBtnText}>未提供電話</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions Row (AI Match Primary, Edit/Delete Small) */}
                    <View style={styles.bottomActions}>
                        {/* AI Match - Main Button (Visible to ALL) */}
                        <Pressable style={styles.mainAiMatchBtn} onPress={handleAIMatch}>
                            <IconSymbol name="sparkles" size={24} color="white" />
                            <Text style={styles.btnTextLarge}>AI 智能比對</Text>
                        </Pressable>

                        {/* Edit/Delete - Small Secondary Buttons (Owner Only) */}
                        {String(report.user_id) === String(CURRENT_USER_ID) && (
                            <View style={styles.secondaryActions}>
                                <Pressable style={styles.iconBtn} onPress={handleEdit}>
                                    <IconSymbol name="pencil" size={20} color="#666" />
                                </Pressable>
                                <Pressable style={[styles.iconBtn, { backgroundColor: '#FFEEED' }]} onPress={handleDelete}>
                                    <IconSymbol name="trash.fill" size={20} color="#FF6B6B" />
                                </Pressable>
                            </View>
                        )}

                        {/* Call Owner Logic for NON-Owner (if not handled above in Contact Button, but here we want AI Match for owner) */}
                    </View>

                    {/* Comments Section */}
                    <View style={styles.commentSection}>
                        <Text style={styles.commentHeader}>留言板 ({comments.length})</Text>

                        {comments.map((c) => (
                            <View key={c.id} style={styles.commentItem}>
                                <View style={styles.commentAvatar}>
                                    <IconSymbol name="person.circle.fill" size={30} color="#ccc" />
                                </View>
                                <View style={styles.commentContent}>
                                    <View style={styles.commentMeta}>
                                        <Text style={styles.commentUser}>{c.user_id}</Text>
                                        <Text style={styles.commentTime}>{new Date(c.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.commentText}>{c.content}</Text>
                                </View>
                            </View>
                        ))}

                        {comments.length === 0 && <Text style={styles.noComments}>暫無留言，提供一點線索吧！</Text>}

                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.input}
                                placeholder="提供線索或留言..."
                                value={newComment}
                                onChangeText={setNewComment}
                            />
                            <Pressable onPress={postComment} disabled={submittingComment} style={styles.sendBtn}>
                                <IconSymbol name="paperplane.fill" size={20} color={submittingComment ? "#ccc" : "#4ECDC4"} />
                            </Pressable>
                        </View>
                    </View>

                    <View style={{ height: 50 }} />
                </View>
            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    // Carousel
    carouselContainer: { position: 'relative', height: 400 }, // Taller carousel
    image: { height: 400, resizeMode: 'cover' },
    pagination: { position: 'absolute', bottom: 20, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)', marginHorizontal: 4 },
    activeDot: { backgroundColor: '#fff', width: 10, height: 10 },

    // Status Toggle Styles
    statusContainer: {
        position: 'absolute', top: 40, right: 20, zIndex: 20
    },
    statusToggle: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 25,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 5,
        gap: 10
    },
    statusLabel: { fontWeight: 'bold', fontSize: 15 },

    // Legacy Badge (Viewer)
    badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
    badgeText: { color: 'white', fontWeight: 'bold', fontSize: 13 },

    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, position: 'absolute', top: 40, left: 20, zIndex: 10 },
    navButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 20 },
    navTitle: { display: 'none' }, // Hide title in nav bar as it's transparent now

    contentContainer: {
        flex: 1,
        marginTop: -30, // Overlap effect
        backgroundColor: '#fff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 25,
        paddingBottom: 50
    },

    // Header
    headerRow: { marginBottom: 20 },
    speciesBig: { fontSize: 32, fontWeight: 'bold', color: '#333' }, // Larger Title
    time: { color: '#888', fontSize: 14, marginTop: 4 },

    // Info Cards (Sex, Size, Age)
    infoCardsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25, gap: 10 },
    infoCard: {
        flex: 1, backgroundColor: '#F8F9FA', borderRadius: 15, padding: 15,
        alignItems: 'center', justifyContent: 'center', gap: 8
    },
    infoCardText: { color: '#555', fontWeight: 'bold', fontSize: 14 },

    // AI Highlight (Found Only)
    aiHighlight: {
        backgroundColor: '#F0F4FF', borderRadius: 15, padding: 15, marginBottom: 25,
        borderWidth: 1, borderColor: '#cad5ff', flexDirection: 'column', gap: 5
    },
    aiHighlightTitle: { color: '#6C63FF', fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
    aiHighlightText: { color: '#333', fontSize: 16, fontWeight: '500' },

    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },

    // Map Preview
    addressText: { color: '#666', fontSize: 15, marginBottom: 10 },
    mapPreview: {
        width: '100%', height: 150, borderRadius: 15, overflow: 'hidden',
        backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center'
    },
    mapPlaceholder: { alignItems: 'center', gap: 8 },
    mapText: { color: '#666', fontWeight: '600' },

    descriptionText: { fontSize: 16, color: '#444', lineHeight: 24 },

    // Contact Button (Primary)
    primaryCallBtn: {
        backgroundColor: '#4ECDC4', flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        paddingVertical: 16, borderRadius: 15, gap: 10,
        shadowColor: "#4ECDC4", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6
    },
    primaryCallText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    disabledBtn: { backgroundColor: '#f0f0f0', padding: 15, borderRadius: 15, alignItems: 'center' },
    disabledBtnText: { color: '#aaa', fontSize: 16 },

    // Bottom Action Row
    bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 10, marginBottom: 30 },

    // AI Match Button (Dominant)
    mainAiMatchBtn: {
        flex: 1, backgroundColor: '#6C63FF', flexDirection: 'row',
        justifyContent: 'center', alignItems: 'center',
        paddingVertical: 15, borderRadius: 15, gap: 8,
        shadowColor: "#6C63FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6
    },

    // Secondary Actions (Edit/Delete - Small)
    secondaryActions: { flexDirection: 'row', gap: 10 },
    iconBtn: {
        width: 50, height: 50, borderRadius: 15, backgroundColor: '#F0F0F0',
        justifyContent: 'center', alignItems: 'center'
    },

    btnTextLarge: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },

    // Comments (Keep existing styles lightweight)
    commentSection: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 20 },
    commentHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
    commentItem: { flexDirection: 'row', marginBottom: 15 },
    commentAvatar: { marginRight: 10 },
    commentContent: { flex: 1, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 10 },
    commentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    commentUser: { fontWeight: 'bold', color: '#555' },
    commentTime: { fontSize: 10, color: '#999' },
    commentText: { color: '#333' },
    noComments: { textAlign: 'center', color: '#999', marginBottom: 15 },
    inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
    input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16 },
    sendBtn: { padding: 10 },

    // Keep badge classes for compiler safety if used elsewhere, but ideally unused now
    species: { display: 'none' }, // Replaced by speciesBig
    region: { display: 'none' },
    aiCard: { display: 'none' }, aiHeader: { display: 'none' }, aiTitle: { display: 'none' }, aiContent: { display: 'none' }, aiRow: { display: 'none' }, aiLabel: { display: 'none' }, aiValue: { display: 'none' },
    grid: { display: 'none' }, gridItem: { display: 'none' }, gridLabel: { display: 'none' }, gridValue: { display: 'none' },
    infoRow: { display: 'none' }, infoLabel: { display: 'none' }, infoValue: { display: 'none' },
    contactCard: { display: 'none' }, contactName: { display: 'none' }, phoneRow: { display: 'none' }, contactPhone: { display: 'none' },
    actionRow: { display: 'none' }, callBtn: { display: 'none' }, editBtn: { display: 'none' }, deleteBtn: { display: 'none' }, aiMatchBtn: { display: 'none' }, btnText: { display: 'none' },
});
