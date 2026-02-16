import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Animated, PanResponder, Dimensions, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 120;

import { API_URL } from '@/constants/config';

type MatchResult = {
    report: {
        id: number;
        image_path: string;
        species: string;
        breed: string | null;
        color: string | null;
        sex: string | null;
        last_seen_location: string | null;
        features: string | null;
        description: string | null;
        created_at: string;
    };
    match_score: number;
    match_details: {
        distance?: string;
        common_keywords?: string[];
    };
};

export default function MatchResultsScreen() {
    const { reportId, petId } = useLocalSearchParams();
    const router = useRouter();
    const [matches, setMatches] = useState<MatchResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Animation values
    const position = useRef(new Animated.ValueXY()).current;

    // PanResponder for Swipe
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (_, gesture) => {
                position.setValue({ x: gesture.dx, y: gesture.dy });
            },
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dx > SWIPE_THRESHOLD) {
                    forceSwipe('right');
                } else if (gesture.dx < -SWIPE_THRESHOLD) {
                    forceSwipe('left');
                } else {
                    resetPosition();
                }
            }
        })
    ).current;

    useEffect(() => {
        if (reportId || petId) {
            fetchMatches();
        }
    }, [reportId, petId]);

    const fetchMatches = async () => {
        try {
            setLoading(true);

            let url;
            if (reportId) {
                // Existing report-based matching
                url = `${API_URL}/api/reports/${reportId}/match`;
            } else if (petId) {
                // New pet-based matching - match lost reports for this pet
                url = `${API_URL}/api/pets/${petId}/match-lost`;
            } else {
                console.error("No reportId or petId provided");
                setLoading(false);
                return;
            }

            const response = await fetch(url, {
                method: 'POST',
            });
            if (response.ok) {
                const data = await response.json();
                setMatches(data);
            } else {
                // Alert.alert("Error", "Failed to fetch matches");
                console.log("Failed to fetch matches");
            }
        } catch (error) {
            console.error("Match fetch error:", error);
            // Alert.alert("Error", "Network error");
        } finally {
            setLoading(false);
        }
    };

    const forceSwipe = (direction: 'left' | 'right') => {
        const x = direction === 'right' ? SCREEN_WIDTH + 100 : -SCREEN_WIDTH - 100;
        Animated.timing(position, {
            toValue: { x, y: 0 },
            duration: 250,
            useNativeDriver: false // Layout props need false
        }).start(() => onSwipeComplete(direction));
    };

    const onSwipeComplete = (direction: 'left' | 'right') => {
        const item = matches[currentIndex];

        if (direction === 'right') {
            // Match! Go to detail
            router.push({
                pathname: '/report-detail',
                params: { id: item.report.id }
            });
        } else {
            // Pass
            position.setValue({ x: 0, y: 0 });
            setCurrentIndex(prev => prev + 1);
        }
    };

    const resetPosition = () => {
        Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false
        }).start();
    };

    const getCardStyle = () => {
        const rotate = position.x.interpolate({
            inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
            outputRange: ['-30deg', '0deg', '30deg']
        });

        return {
            ...position.getLayout(),
            transform: [{ rotate }]
        };
    };

    const renderCard = (match: MatchResult, index: number) => {
        const isFirst = index === currentIndex;
        const handlers = isFirst ? panResponder.panHandlers : {};

        if (index < currentIndex) return null;

        // Simplify image path logic
        const imageUrl = match.report.image_path.startsWith('http')
            ? match.report.image_path
            : `${API_URL}/${match.report.image_path.replace(/\\/g, '/')}`;

        return (
            <Animated.View
                key={match.report.id}
                style={[styles.card, isFirst && getCardStyle(), { zIndex: matches.length - index, top: 10 * (index - currentIndex) }]}
                {...handlers}
            >
                <Image source={{ uri: imageUrl }} style={styles.image} />

                <View style={styles.infoContainer}>
                    <View style={styles.headerRow}>
                        <Text style={styles.matchesText}>{match.match_score}% 相似</Text>
                        <Text style={styles.distanceText}>{match.match_details.distance || '未知距離'}</Text>
                    </View>

                    <Text style={styles.title}>{match.report.species} - {match.report.breed || '混種'}</Text>

                    <View style={styles.chips}>
                        {match.report.sex && <Text style={styles.chip}>{match.report.sex === 'male' ? '公' : '母'}</Text>}
                        {match.report.color && <Text style={styles.chip}>{match.report.color}</Text>}
                    </View>

                    <Text numberOfLines={3} style={styles.description}>
                        {match.report.description || '暫無描述'}
                    </Text>

                    {match.match_details.common_keywords && match.match_details.common_keywords.length > 0 && (
                        <View style={styles.keywordContainer}>
                            <Text style={styles.keywordLabel}>共同特徵：</Text>
                            <Text style={styles.keywordValue}>{match.match_details.common_keywords.join('、')}</Text>
                        </View>
                    )}
                </View>

                {/* Overlay Labels */}
                {isFirst && (
                    <>
                        <Animated.View style={[styles.choiceLabel, styles.nopeLabel, {
                            opacity: position.x.interpolate({
                                inputRange: [-150, 0],
                                outputRange: [1, 0],
                                extrapolate: 'clamp'
                            })
                        }]}>
                            <Text style={styles.nopeText}>PASS</Text>
                        </Animated.View>

                        <Animated.View style={[styles.choiceLabel, styles.likeLabel, {
                            opacity: position.x.interpolate({
                                inputRange: [0, 150],
                                outputRange: [0, 1],
                                extrapolate: 'clamp'
                            })
                        }]}>
                            <Text style={styles.likeText}>MATCH</Text>
                        </Animated.View>
                    </>
                )}
            </Animated.View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6C63FF" />
                <Text style={styles.loadingText}>AI 正在比對中...</Text>
            </View>
        );
    }

    if (matches.length === 0 || currentIndex >= matches.length) {
        return (
            <View style={styles.emptyContainer}>
                <IconSymbol name="checkmark.circle.fill" size={80} color="#4ECDC4" />
                <Text style={styles.emptyTitle}>已看完所有配對</Text>
                <Text style={styles.emptySubtitle}>目前沒有更多相似的尋獲通報，請稍後再試。</Text>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>返回</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.closeBtn}>
                    <IconSymbol name="xmark" size={24} color="#333" />
                </Pressable>
                <Text style={styles.headerTitle}>智能比對結果</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.cardContainer}>
                {matches.map((match, index) => renderCard(match, index))}
            </View>

            <View style={styles.footer}>
                <Pressable style={[styles.actionBtn, styles.passBtn]} onPress={() => forceSwipe('left')}>
                    <IconSymbol name="xmark" size={30} color="#FF6B6B" />
                </Pressable>

                <Text style={styles.footerHint}>左滑無感 · 右滑查看</Text>

                <Pressable style={[styles.actionBtn, styles.matchBtn]} onPress={() => forceSwipe('right')}>
                    <IconSymbol name="heart.fill" size={30} color="#4ECDC4" />
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16, color: '#666' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    closeBtn: { padding: 8 },

    cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
    card: {
        position: 'absolute',
        width: SCREEN_WIDTH * 0.9,
        height: '75%', // Card height
        backgroundColor: 'white',
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#eee',
        overflow: 'hidden'
    },
    image: { width: '100%', height: '50%', resizeMode: 'cover' },
    infoContainer: { padding: 20, flex: 1 },

    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    matchesText: { color: '#6C63FF', fontWeight: 'bold', fontSize: 18 },
    distanceText: { color: '#666', fontSize: 14 },

    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },

    chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    chip: { backgroundColor: '#f0f0f0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', fontSize: 14, color: '#555' },

    description: { fontSize: 16, color: '#444', lineHeight: 22, flex: 1 },

    keywordContainer: { marginTop: 12, padding: 8, backgroundColor: '#f0f7ff', borderRadius: 8 },
    keywordLabel: { fontSize: 12, color: '#666', marginBottom: 2 },
    keywordValue: { fontSize: 14, color: '#0056b3', fontWeight: 'bold' },

    footer: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingBottom: 30 },
    actionBtn: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    passBtn: { borderWidth: 1, borderColor: '#FF6B6B' },
    matchBtn: { borderWidth: 1, borderColor: '#4ECDC4' },
    footerHint: { color: '#999', fontSize: 12 },

    choiceLabel: { position: 'absolute', top: 40, borderWidth: 4, padding: 8, borderRadius: 8, zIndex: 100 },
    likeLabel: { left: 40, borderColor: '#4ECDC4', transform: [{ rotate: '-15deg' }] },
    nopeLabel: { right: 40, borderColor: '#FF6B6B', transform: [{ rotate: '15deg' }] },
    likeText: { color: '#4ECDC4', fontSize: 32, fontWeight: '900', textTransform: 'uppercase' },
    nopeText: { color: '#FF6B6B', fontSize: 32, fontWeight: '900', textTransform: 'uppercase' },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyTitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    emptySubtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 },
    backBtn: { backgroundColor: '#333', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
    backBtnText: { color: 'white', fontWeight: 'bold' },
});
