import { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Image, ActivityIndicator, Alert, TextInput, Button } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React from 'react';
import { API_URL } from '@/constants/config';

const REGIONS = ["北部", "中部", "南部", "東部", "離島"];

export default function FoundPetList({ userId }: { userId?: string }) {
    const router = useRouter();
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters State
    const [filterSpecies, setFilterSpecies] = useState<string | null>(null);
    const [filterSex, setFilterSex] = useState<string>('all');
    const [filterRegion, setFilterRegion] = useState<string | null>(null);
    const [filterSize, setFilterSize] = useState<string | null>(null);
    const [searchText, setSearchText] = useState<string>('');

    // UI State for Collapsible Filters
    const [activeFilter, setActiveFilter] = useState<'species' | 'sex' | 'region' | 'size' | null>(null);

    const getSpeciesLabel = (s: string | null) => {
        if (!s) return '全部';
        if (s === 'dog') return '🐶 狗';
        if (s === 'cat') return '🐱 貓';
        return '🐰 其他';
    };

    const getSexLabel = (s: string) => {
        if (s === 'all') return '全部';
        if (s === 'male') return '公';
        if (s === 'female') return '母';
        return '全部';
    };

    const fetchReports = async () => {
        try {
            setLoading(true);
            let url = `${API_URL}/api/reports?type=found`;
            if (filterSpecies) url += `&species=${filterSpecies}`;
            if (filterSex && filterSex !== 'all') url += `&sex=${filterSex}`;
            if (filterRegion) url += `&location=${filterRegion}`;
            if (filterSize) url += `&size=${filterSize}`;
            if (searchText) url += `&q=${searchText}`;

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setReports(data);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchReports();
        }, [filterSpecies, filterSex, filterRegion, filterSize])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchReports();
    };

    // Standard List Item
    const renderItem = ({ item }: { item: any }) => (
        <Pressable
            style={styles.listItem}
            onPress={() => router.push({ pathname: '/report-detail', params: { id: item.id } })}
        >
            <Image
                source={{ uri: `${API_URL}/${item.image_path}`.replace(/\\/g, '/') }}
                style={styles.itemImage}
                onError={(e) => console.log(`Image load error for ID ${item.id}:`, e.nativeEvent.error)}
            />

            <View style={styles.itemContent}>
                <View style={styles.headerRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.species} {item.breed ? `• ${item.breed}` : ''}
                    </Text>
                    {item.status === 'resolved' && (
                        <View style={styles.resolvedBadge}>
                            <Text style={styles.resolvedText}>已歸還</Text>
                        </View>
                    )}
                </View>

                <View style={styles.detailsRow}>
                    <View style={styles.infoTag}>
                        <IconSymbol name={item.sex === 'male' ? 'gender.male' : (item.sex === 'female' ? 'gender.female' : 'questionmark')} size={12} color="#888" />
                        <Text style={styles.infoText}>{getSexLabel(item.sex)}</Text>
                    </View>
                    <Text style={styles.separator}>|</Text>
                    <View style={styles.infoTag}>
                        <IconSymbol name="location.fill" size={12} color="#888" />
                        <Text style={styles.infoText} numberOfLines={1}>{item.last_seen_location || "未知地點"}</Text>
                    </View>
                    <Text style={styles.separator}>|</Text>
                    <View style={styles.infoTag}>
                        <IconSymbol name="calendar" size={12} color="#888" />
                        <Text style={styles.infoText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                </View>

                <Text style={styles.descText} numberOfLines={1}>
                    {item.description || "無描述"}
                </Text>
            </View>

            <IconSymbol name="chevron.right" size={16} color="#ccc" />
        </Pressable>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Filter Buttons Row */}
            <View style={styles.filterBar}>
                <Pressable
                    style={[styles.filterButton, activeFilter === 'species' && styles.filterButtonActive]}
                    onPress={() => setActiveFilter(activeFilter === 'species' ? null : 'species')}
                >
                    <Text style={[styles.filterButtonText, activeFilter === 'species' && styles.filterButtonTextActive]}>
                        物種: {getSpeciesLabel(filterSpecies)}
                    </Text>
                    <IconSymbol name="chevron.down" size={12} color={activeFilter === 'species' ? "white" : "#666"} />
                </Pressable>

                <Pressable
                    style={[styles.filterButton, activeFilter === 'sex' && styles.filterButtonActive]}
                    onPress={() => setActiveFilter(activeFilter === 'sex' ? null : 'sex')}
                >
                    <Text style={[styles.filterButtonText, activeFilter === 'sex' && styles.filterButtonTextActive]}>
                        性別: {getSexLabel(filterSex)}
                    </Text>
                    <IconSymbol name="chevron.down" size={12} color={activeFilter === 'sex' ? "white" : "#666"} />
                </Pressable>

                <Pressable
                    style={[styles.filterButton, activeFilter === 'region' && styles.filterButtonActive]}
                    onPress={() => setActiveFilter(activeFilter === 'region' ? null : 'region')}
                >
                    <Text style={[styles.filterButtonText, activeFilter === 'region' && styles.filterButtonTextActive]}>
                        地區: {filterRegion || '全台'}
                    </Text>
                    <IconSymbol name="chevron.down" size={12} color={activeFilter === 'region' ? "white" : "#666"} />
                </Pressable>

                <Pressable
                    style={[styles.filterButton, activeFilter === 'size' && styles.filterButtonActive]}
                    onPress={() => setActiveFilter(activeFilter === 'size' ? null : 'size')}
                >
                    <Text style={[styles.filterButtonText, activeFilter === 'size' && styles.filterButtonTextActive]}>
                        體型: {filterSize || '全部'}
                    </Text>
                    <IconSymbol name="chevron.down" size={12} color={activeFilter === 'size' ? "white" : "#666"} />
                </Pressable>
            </View>

            {/* Expansible Options Panel */}
            {activeFilter && (
                <View style={styles.filterOptionsPanel}>
                    {activeFilter === 'species' && (
                        <View style={styles.optionRow}>
                            <Pressable style={[styles.optionChip, !filterSpecies && styles.optionChipActive]} onPress={() => { setFilterSpecies(null); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, !filterSpecies && styles.optionTextActive]}>全部</Text>
                            </Pressable>
                            <Pressable style={[styles.optionChip, filterSpecies === 'dog' && styles.optionChipActive]} onPress={() => { setFilterSpecies('dog'); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, filterSpecies === 'dog' && styles.optionTextActive]}>🐶 狗</Text>
                            </Pressable>
                            <Pressable style={[styles.optionChip, filterSpecies === 'cat' && styles.optionChipActive]} onPress={() => { setFilterSpecies('cat'); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, filterSpecies === 'cat' && styles.optionTextActive]}>🐱 貓</Text>
                            </Pressable>
                            <Pressable style={[styles.optionChip, filterSpecies === 'other' && styles.optionChipActive]} onPress={() => { setFilterSpecies('other'); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, filterSpecies === 'other' && styles.optionTextActive]}>🐰 其他</Text>
                            </Pressable>
                        </View>
                    )}

                    {activeFilter === 'sex' && (
                        <View style={styles.optionRow}>
                            <Pressable style={[styles.optionChip, filterSex === 'all' && styles.optionChipActive]} onPress={() => { setFilterSex('all'); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, filterSex === 'all' && styles.optionTextActive]}>全部</Text>
                            </Pressable>
                            <Pressable style={[styles.optionChip, filterSex === 'male' && styles.optionChipActive]} onPress={() => { setFilterSex('male'); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, filterSex === 'male' && styles.optionTextActive]}>公</Text>
                            </Pressable>
                            <Pressable style={[styles.optionChip, filterSex === 'female' && styles.optionChipActive]} onPress={() => { setFilterSex('female'); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, filterSex === 'female' && styles.optionTextActive]}>母</Text>
                            </Pressable>
                        </View>
                    )}

                    {activeFilter === 'region' && (
                        <View style={styles.optionRow}>
                            <Pressable style={[styles.optionChip, !filterRegion && styles.optionChipActive]} onPress={() => { setFilterRegion(null); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, !filterRegion && styles.optionTextActive]}>全台</Text>
                            </Pressable>
                            {REGIONS.map(r => (
                                <Pressable key={r} style={[styles.optionChip, filterRegion === r && styles.optionChipActive]} onPress={() => { setFilterRegion(r); setActiveFilter(null); }}>
                                    <Text style={[styles.optionText, filterRegion === r && styles.optionTextActive]}>{r}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {activeFilter === 'size' && (
                        <View style={styles.optionRow}>
                            <Pressable style={[styles.optionChip, !filterSize && styles.optionChipActive]} onPress={() => { setFilterSize(null); setActiveFilter(null); }}>
                                <Text style={[styles.optionText, !filterSize && styles.optionTextActive]}>全部</Text>
                            </Pressable>
                            {['Small', 'Medium', 'Large'].map(s => (
                                <Pressable key={s} style={[styles.optionChip, filterSize === s && styles.optionChipActive]} onPress={() => { setFilterSize(s); setActiveFilter(null); }}>
                                    <Text style={[styles.optionText, filterSize === s && styles.optionTextActive]}>{s}</Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {/* General Search */}
            <View style={styles.searchRow}>
                <IconSymbol name="magnifyingglass" size={20} color="#666" style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="搜尋特徵、品種、描述..."
                    value={searchText}
                    onChangeText={setSearchText}
                    onSubmitEditing={fetchReports}
                    returnKeyType="search"
                />
                {searchText ? (
                    <Pressable onPress={() => { setSearchText(''); fetchReports(); }}>
                        <IconSymbol name="xmark.circle.fill" size={16} color="#999" />
                    </Pressable>
                ) : null}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#4ECDC4" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={reports}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    ListHeaderComponent={
                        <View style={{ alignItems: 'center', marginBottom: 10 }}>
                            <Text style={{ color: '#999', fontSize: 10 }}>下拉刷新以更新資料</Text>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>沒有符合條件的寵物</Text>
                            <Button title="重新載入" onPress={fetchReports} color="#4ECDC4" />
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    filterBar: { flexDirection: 'row', paddingHorizontal: 20, marginVertical: 10, gap: 10 },
    filterButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#eee', gap: 5 },
    filterButtonActive: { backgroundColor: '#4ECDC4', borderColor: '#4ECDC4' },
    filterButtonText: { fontSize: 14, fontWeight: 'bold', color: '#555' },
    filterButtonTextActive: { color: 'white' },

    filterOptionsPanel: { backgroundColor: 'white', paddingVertical: 15, paddingHorizontal: 20, marginHorizontal: 15, borderRadius: 15, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    optionChip: { paddingHorizontal: 15, paddingVertical: 8, backgroundColor: '#f5f5f5', borderRadius: 20 },
    optionChipActive: { backgroundColor: '#4ECDC4' },
    optionText: { color: '#555', fontWeight: '600' },
    optionTextActive: { color: 'white' },

    searchRow: { flexDirection: 'row', marginHorizontal: 15, marginBottom: 10, backgroundColor: 'white', borderRadius: 10, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#eee' },
    searchInput: { flex: 1, fontSize: 15 },

    // List & Items
    listContent: { paddingBottom: 80 },
    listItem: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    itemImage: {
        width: 70, height: 70, borderRadius: 8, resizeMode: 'cover', backgroundColor: '#f0f0f0', marginRight: 15
    },
    itemContent: { flex: 1, gap: 4 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    itemTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },

    detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    infoTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    infoText: { fontSize: 12, color: '#888' },
    separator: { fontSize: 10, color: '#ddd' },

    descText: { fontSize: 13, color: '#aaa', fontStyle: 'italic', marginTop: 2 },

    resolvedBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    resolvedText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, color: '#888', fontWeight: 'bold' },
});
