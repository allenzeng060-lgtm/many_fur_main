import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Image, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added
import { API_URL } from '@/constants/config';
import { getRegionFromCity } from '@/utils/regionMapping';
import { IconSymbol } from '@/components/ui/icon-symbol';

import { CURRENT_USER_ID } from '@/constants/User';

export default function ReportFoundScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [reportId, setReportId] = useState<number | null>(null);
    const [step, setStep] = useState(1); // 1: Upload & Analyze, 2: Edit Details

    // Form Data (Initialized empty, will fill from AI)
    const [userId, setUserId] = useState<string>(String(CURRENT_USER_ID)); // Unified User

    // AI Fields + Manual Fields
    const [species, setSpecies] = useState('');
    const [breed, setBreed] = useState('');
    const [color, setColor] = useState('');
    const [sex, setSex] = useState(''); // AI might guess, user confirms
    const [size, setSize] = useState(''); // Added
    const [features, setFeatures] = useState('');
    const [description, setDescription] = useState('');

    // ID & Accessories
    const [collar, setCollar] = useState('');
    const [microchipId, setMicrochipId] = useState('');
    const [hasTag, setHasTag] = useState(false);

    // Extra Fields (Manual)
    const [lastSeenLocation, setLastSeenLocation] = useState('');
    const [region, setRegion] = useState(''); // Added
    const [foundTime, setFoundTime] = useState(new Date().toLocaleString('zh-TW', { hour12: false }));
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [lat, setLat] = useState('25.0330');
    const [lng, setLng] = useState('121.5654');

    useEffect(() => {
        // Load User ID
        const loadUser = async () => {
            try {
                const token = await AsyncStorage.getItem("auth_token");
                if (token === "guest_token") {
                    setUserId("guest");
                } else {
                    const userInfoStr = await AsyncStorage.getItem("user_info");
                    if (userInfoStr) {
                        const userInfo = JSON.parse(userInfoStr);
                        setUserId(String(userInfo.id));
                    }
                }
            } catch (e) {
                console.log("Error loading user info", e);
            }
        };
        loadUser();
    }, []);

    useEffect(() => {
        if (id) {
            setLoading(true);
            fetch(`${API_URL}/api/reports/${id}`)
                .then(res => res.json())
                .then(data => {
                    setReportId(data.id);
                    setSpecies(data.species || '');
                    setBreed(data.breed || '');
                    setColor(data.color || '');
                    setSex(data.sex || '');
                    setSize(data.size || '');
                    setFeatures(data.features || '');
                    setDescription(data.description || '');
                    setCollar(data.collar || '');
                    setMicrochipId(data.microchip_id || '');
                    setHasTag(data.has_tag || false);
                    setLastSeenLocation(data.last_seen_location || '');
                    setRegion(data.region || '');
                    setFoundTime(data.lost_time || new Date().toLocaleString('zh-TW', { hour12: false }));
                    setContactName(data.contact_name || '');
                    setContactPhone(data.contact_phone || '');
                    if (data.lat) setLat(data.lat.toString());
                    if (data.lng) setLng(data.lng.toString());
                    if (data.image_path) {
                        setImages([`${API_URL}/${data.image_path}`.replace(/\\/g, '/')]);
                        if (data.images && data.images.length > 0) {
                            setImages(data.images.map((img: any) => `${API_URL}/${img.image_path}`.replace(/\\/g, '/')));
                        }
                    }
                    setStep(2);
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        } else {
            // Auto-fetch location for new reports
            (async () => {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission to access location was denied');
                    return;
                }

                let location = await Location.getCurrentPositionAsync({});
                const { latitude, longitude } = location.coords;
                setLat(latitude.toString());
                setLng(longitude.toString());

                try {
                    let address = await Location.reverseGeocodeAsync({ latitude, longitude });
                    if (address && address.length > 0) {
                        const city = address[0].city || address[0].region || '';
                        const district = address[0].district || '';
                        const street = address[0].street || '';
                        const fullAddress = `${city}${district}${street}`;
                        setLastSeenLocation(fullAddress);

                        if (city || address[0].region) {
                            const detectedRegion = getRegionFromCity(city || address[0].region || '');
                            setRegion(detectedRegion);
                            console.log("Auto-Detected Region:", detectedRegion);
                        }
                    } else {
                        setLastSeenLocation(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
                    }
                } catch (e) {
                    console.log("Reverse Geocode failed", e);
                    setLastSeenLocation(`Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`);
                }
            })();
        }
    }, [id]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            setImages(prev => [...prev, ...newUris]);
            setReportId(null);
            setStep(1);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // Step 1: Upload Image & Get AI Analysis (Stateless, No DB)
    const analyzeAndCreate = async () => {
        if (images.length === 0) {
            Alert.alert('Please select at least one image');
            return;
        }

        setLoading(true);
        const formData = new FormData();

        // Only send the first image for analysis
        const imgUri = images[0];
        const filename = imgUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        if (Platform.OS === 'web') {
            const res = await fetch(imgUri);
            const blob = await res.blob();
            formData.append('file', blob, filename || `upload.jpg`);
        } else {
            // @ts-ignore
            formData.append('file', { uri: imgUri, name: filename, type });
        }

        try {
            console.log("Analyzing...", `${API_URL}/api/analyze`);
            const response = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                console.log("AI Result:", data);

                // Pre-fill form with AI results
                // Note: We do NOT set reportId here because it's not saved yet.
                setSpecies(data.species || 'other');
                setBreed(data.breed || '');
                setColor(data.color || '');
                setSex(data.sex || '');
                setSize(data.size || '');
                setFeatures(data.features || '');
                setDescription(data.description || '');

                // Move to Step 2
                setStep(2);
            } else {
                const errorData = await response.json();
                Alert.alert('Error', 'Analysis failed: ' + (errorData.detail || 'Unknown error'));
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'Network error');
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Create Report with Images & Manual Details
    const saveDetails = async () => {
        // Validation
        const missingGroups = new Set<string>();
        // Found details specific validation
        if (!species || !lastSeenLocation) missingGroups.add('基本資料 (物種、發現地點)');
        if (!contactName || !contactPhone) missingGroups.add('聯絡資訊 (聯絡人、電話)');

        if (missingGroups.size > 0) {
            if (Platform.OS === 'web') {
                window.alert(`資料不完整\n請填寫以下資訊：\n${Array.from(missingGroups).join('、')}`);
            } else {
                Alert.alert('資料不完整', `請填寫以下資訊：\n${Array.from(missingGroups).join('、')}`);
            }
            return;
        }

        setLoading(true);
        const formData = new FormData();

        // Standard Data
        formData.append('user_id', userId);
        formData.append('lat', lat);
        formData.append('lng', lng);

        if (species) formData.append('species', species);
        if (breed) formData.append('breed', breed);
        if (color) formData.append('color', color);
        if (sex) formData.append('sex', sex);
        if (size) formData.append('size', size);
        if (features) formData.append('features', features);
        if (description) formData.append('description', description);
        if (collar) formData.append('collar', collar);
        if (microchipId) formData.append('microchip_id', microchipId);
        formData.append('has_tag', hasTag.toString());

        if (lastSeenLocation) formData.append('last_seen_location', lastSeenLocation);
        if (region) formData.append('region', region);
        if (foundTime) formData.append('lost_time', foundTime);
        if (contactName) formData.append('contact_name', contactName);
        if (contactPhone) formData.append('contact_phone', contactPhone);

        // Re-append Images (Create Flow)
        for (let i = 0; i < images.length; i++) {
            const imgUri = images[i];
            const filename = imgUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename || '');
            const type = match ? `image/${match[1]}` : `image/jpeg`;

            if (Platform.OS === 'web') {
                const res = await fetch(imgUri);
                const blob = await res.blob();
                formData.append('files', blob, filename || `upload_${i}.jpg`);
            } else {
                // @ts-ignore
                formData.append('files', { uri: imgUri, name: filename, type });
            }
        }

        try {
            // Determine if Create or Update
            // If reportId exists (from editing existing), then PUT.
            // If reportId is null (new flow), then POST.
            const url = reportId ? `${API_URL}/api/reports/${reportId}` : `${API_URL}/api/reports/found`;
            const method = reportId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                body: formData,
            });

            if (response.ok) {
                if (Platform.OS === 'web') {
                    window.alert('通報已送出');
                    router.replace('/(tabs)/finding?initialMode=found');
                } else {
                    Alert.alert('成功', '通報已送出', [
                        { text: 'OK', onPress: () => router.replace('/(tabs)/finding?initialMode=found') }
                    ]);
                }
            } else {
                const errorText = await response.text();
                // console.error(errorText);
                Alert.alert('錯誤', '送出失敗: ' + errorText);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#fbfaff" }}>
            {/* Background Bubbles */}
            <View pointerEvents="none" style={styles.bg}>
                <View style={[styles.bubble, styles.b1]} />
                <View style={[styles.bubble, styles.b2]} />
                <View style={[styles.bubble, styles.b3]} />
                <View style={[styles.bubble, styles.b4]} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <View style={styles.customHeader}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <IconSymbol name="chevron.left" size={24} color="#333" />
                        <Text style={styles.backText}>取消</Text>
                    </Pressable>
                    <Text style={styles.headerTitle}>通報尋獲</Text>
                    <View style={{ width: 60 }} />
                </View>

                <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Step 1: Image Upload */}
                    <ScrollView horizontal style={styles.imageScroll} contentContainerStyle={styles.imageScrollContent}>
                        <Pressable onPress={pickImage} style={styles.addImageBox}>
                            <IconSymbol name="plus" size={30} color="#888" />
                            <Text style={styles.placeholderText}>Add Photo</Text>
                        </Pressable>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imageContainer}>
                                <Image source={{ uri }} style={styles.thumbnail} />
                                <Pressable onPress={() => removeImage(index)} style={styles.removeBtn}>
                                    <IconSymbol name="xmark.circle.fill" size={20} color="red" />
                                </Pressable>
                            </View>
                        ))}
                    </ScrollView>

                    {loading && <ActivityIndicator size="large" color="#4ECDC4" style={{ marginBottom: 20 }} />}

                    {step === 1 && !loading && (
                        <View>
                            <Text style={styles.hint}>請上傳清晰照片，AI 將自動辨識物種與特徵。</Text>
                            <Pressable
                                onPress={analyzeAndCreate}
                                style={({ pressed }) => [
                                    styles.aiBtn,
                                    pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }
                                ]}
                            >
                                <IconSymbol name="sparkles" size={18} color="#fff" />
                                <Text style={styles.aiBtnText}>開始辨識 (AI Analyze)</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Step 2: Edit Form */}
                    {step === 2 && (
                        <View style={styles.formContainer}>
                            <Text style={styles.sectionHeader}>📋 AI 辨識結果 (可修改)</Text>

                            <Text style={styles.label}>物種 (Species)</Text>
                            <View style={styles.row}>
                                {['dog', 'cat', 'other'].map(s => (
                                    <Pressable key={s} onPress={() => setSpecies(s)} style={[styles.typeBtn, species === s && styles.activeType]}>
                                        <Text style={[styles.typeText, species === s && styles.activeText]}>{s === 'dog' ? '狗' : (s === 'cat' ? '貓' : '其他')}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text style={styles.label}>品種 (Breed)</Text>
                            <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="例如：柴犬" />

                            <Text style={styles.label}>毛色 (Color)</Text>
                            <TextInput style={styles.input} value={color} onChangeText={setColor} />

                            <Text style={styles.label}>體型 (Size)</Text>
                            <View style={styles.row}>
                                {['Small', 'Medium', 'Large'].map(s => (
                                    <Pressable key={s} onPress={() => setSize(s)} style={[styles.typeBtn, size === s && styles.activeType]}>
                                        <Text style={[styles.typeText, size === s && styles.activeText]}>{s}</Text>
                                    </Pressable>
                                ))}
                            </View>

                            <Text style={styles.label}>特徵 (Features)</Text>
                            <TextInput style={[styles.input, styles.textArea]} value={features} onChangeText={setFeatures} multiline />

                            <Text style={styles.sectionHeader}>🏷️ 配件與 ID</Text>

                            <Text style={styles.label}>項圈 (Collar)</Text>
                            <TextInput style={styles.input} value={collar} onChangeText={setCollar} placeholder="例如：紅色皮項圈" />

                            <Text style={styles.label}>晶片號碼 (Microchip ID)</Text>
                            <TextInput style={styles.input} value={microchipId} onChangeText={setMicrochipId} placeholder="例如：900123..." keyboardType="numeric" />

                            <View style={styles.row}>
                                <Text style={[styles.label, { marginTop: 0, marginRight: 10 }]}>有吊牌? (Has Tag?)</Text>
                                <Switch value={hasTag} onValueChange={setHasTag} trackColor={{ false: "#767577", true: "#4ECDC4" }} thumbColor={hasTag ? "#fff" : "#f4f3f4"} />
                            </View>

                            <Text style={styles.sectionHeader}>📍 地點與聯絡</Text>

                            <Text style={styles.label}>發現時間 (Time)</Text>
                            <TextInput style={styles.input} value={foundTime} onChangeText={setFoundTime} placeholder="YYYY-MM-DD HH:mm:ss" />

                            <Text style={styles.label}>發現地點 (Location) *</Text>
                            <TextInput style={styles.input} value={lastSeenLocation} onChangeText={setLastSeenLocation} placeholder="例如：大安森林公園" />

                            <Text style={styles.label}>聯絡人 (Contact Name) *</Text>
                            <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="您的稱呼" />

                            <Text style={styles.label}>聯絡電話 (Phone) *</Text>
                            <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />

                            <View style={{ marginTop: 20 }}>
                                <Button title="送出通報 (Submit)" onPress={saveDetails} color="#4ECDC4" disabled={loading} />
                            </View>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },

    // Background Bubbles
    bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
    bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
    b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
    b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
    b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },
    b4: { width: 200, height: 200, right: 20, bottom: 100, backgroundColor: "#e2f6ff" },

    customHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: 'transparent',
        marginTop: Platform.OS === 'ios' ? 50 : 30  // 增加 iOS 上邊距避開劉海
    },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#FFF', borderRadius: 12 },
    backText: { fontSize: 16, color: '#333', marginLeft: 4 },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#1F1F2A' },

    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: '#4ECDC4', display: 'none' }, // Hide old title
    imageBox: {
        width: '100%', height: 200, backgroundColor: '#f0f0f0', borderRadius: 10,
        marginBottom: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'
    },
    imageScroll: { maxHeight: 120, marginBottom: 20 },
    imageScrollContent: { alignItems: 'center', paddingRight: 20 },
    addImageBox: { width: 100, height: 100, borderRadius: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed' },
    imageContainer: { position: 'relative', marginRight: 15 },
    thumbnail: { width: 100, height: 100, borderRadius: 10 },
    removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: 'white', borderRadius: 12 },
    image: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholder: { alignItems: 'center' },
    placeholderText: { color: '#888' },
    hint: { textAlign: 'center', color: '#666', marginBottom: 20 },
    aiBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#4ECDC4',
        paddingVertical: 14,
        borderRadius: 14,
        shadowColor: "#4ECDC4",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 4
    },
    aiBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },

    formContainer: { marginTop: 10 },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 15, color: '#333', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
    label: { fontSize: 14, fontWeight: '600', marginTop: 10, marginBottom: 5, color: '#555' },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 5, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.8)' },
    textArea: { height: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 10, marginBottom: 5 },
    typeBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
    activeType: { backgroundColor: '#4ECDC4', borderColor: '#4ECDC4' },
    typeText: { color: '#333' },
    activeText: { color: 'white', fontWeight: 'bold' },
});
