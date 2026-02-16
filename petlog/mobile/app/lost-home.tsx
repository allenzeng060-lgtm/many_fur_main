import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, Alert, Dimensions, StatusBar, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '@/constants/config';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = height * 0.7;

export default function LostHomeScreen() {
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false); // For Pull-to-Refresh

    const fetchReports = async () => {
        try {
            setLoading(true);
            console.log(`Fetching reports from ${API_URL}/api/reports?type=lost`);
            const response = await fetch(`${API_URL}/api/reports?type=lost`);
            if (response.ok) {
                const data = await response.json();
                console.log("Reports fetched:", data.length);
                setReports(data);
            } else {
                console.error('Failed to fetch reports:', response.status);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            Alert.alert('Error', 'Could not load reports');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchReports();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchReports();
    };

    const renderItem = ({ item }: { item: any }) => (
        <Pressable
            style={styles.cardContainer}
            onPress={() => router.push({ pathname: '/report-detail', params: { id: item.id } })}
        >
            <View style={styles.card}>
                <Image source={{ uri: `${API_URL}/${item.image_path}`.replace(/\\/g, '/') }} style={styles.cardImage} />

                {/* Gradient Overlay for text readability */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.gradient}
                />

                <View style={styles.cardContent}>
                    <View style={styles.headerRow}>
                        <Text style={styles.name}>{item.name || 'Unknown'}</Text>
                        <Text style={styles.age}>{item.age || 'Age ?'}</Text>
                    </View>

                    <Text style={styles.breed}>{item.species} • {item.breed || 'Mix'}</Text>

                    <View style={styles.locationRow}>
                        <IconSymbol name="location.fill" size={16} color="#ddd" />
                        <Text style={styles.location} numberOfLines={1}>{item.last_seen_location || 'No location'}</Text>
                    </View>

                    {item.reward ? (
                        <View style={styles.rewardBadge}>
                            <Text style={styles.rewardText}>💰 {item.reward}</Text>
                        </View>
                    ) : null}

                    <View style={styles.tagsRow}>
                        <View style={styles.tag}><Text style={styles.tagText}>{item.sex || '?'}</Text></View>
                        <View style={styles.tag}><Text style={styles.tagText}>{item.color || '?'}</Text></View>
                    </View>
                </View>

                {/* Status Badge */}
                {item.status === 'resolved' && (
                    <View style={styles.resolvedOverlay}>
                        <Text style={styles.resolvedText}>已尋獲</Text>
                    </View>
                )}
            </View>
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.header}>走失寵物協尋</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#FF6B6B" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={reports}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    snapToAlignment="center"
                    decelerationRate="fast"
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>目前沒有走失寵物通報</Text>
                            <Text style={styles.emptySubText}>點擊 + 新增通報</Text>
                        </View>
                    }
                />
            )}

            <Pressable
                style={styles.fab}
                onPress={() => router.push('/report-lost')}
            >
                <IconSymbol name="plus" size={30} color="white" />
            </Pressable>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        fontSize: 28,
        fontWeight: 'bold',
        marginLeft: 20,
        marginTop: 10,
        marginBottom: 10,
        color: '#FF6B6B',
    },
    listContent: {
        paddingHorizontal: 10,
        alignItems: 'center',
    },
    cardContainer: {
        width: width, // Full width for paging to work well
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 20,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
    },
    cardContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 5,
    },
    name: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginRight: 10,
    },
    age: {
        fontSize: 22,
        color: '#eee',
        marginBottom: 3,
    },
    breed: {
        fontSize: 18,
        color: '#ddd',
        marginBottom: 15,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    location: {
        fontSize: 16,
        color: '#ddd',
        marginLeft: 5,
    },
    rewardBadge: {
        backgroundColor: '#FF6B6B',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    rewardText: {
        color: 'white',
        fontWeight: 'bold',
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    tag: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    tagText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    resolvedOverlay: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: '#4CAF50',
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 5,
        transform: [{ rotate: '15deg' }]
    },
    resolvedText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 18,
        borderWidth: 2,
        borderColor: 'white',
        padding: 5,
        borderRadius: 5,
    },
    emptyState: {
        width: width,
        height: CARD_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: 20,
        color: '#888',
        fontWeight: 'bold',
    },
    emptySubText: {
        fontSize: 16,
        color: '#aaa',
        marginTop: 10,
    },
    fab: {
        position: 'absolute',
        right: 30,
        bottom: 30,
        width: 65,
        height: 65,
        borderRadius: 35,
        backgroundColor: '#FF6B6B',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
});
