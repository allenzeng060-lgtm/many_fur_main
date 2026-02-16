import { useState, useEffect } from 'react';
import { View, Text, TextInput, Image, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added
import { API_URL } from '@/constants/config';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getRegionFromCity } from '@/utils/regionMapping';

import { CURRENT_USER_ID } from '@/constants/User';

export default function ReportLostScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [images, setImages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [userId, setUserId] = useState<string>(String(CURRENT_USER_ID)); // Default to mock, but will update

    const [species, setSpecies] = useState('dog');
    const [name, setName] = useState('');
    const [breed, setBreed] = useState('');
    const [color, setColor] = useState('');
    const [sex, setSex] = useState('unknown'); // Changed default
    const [age, setAge] = useState('');
    const [size, setSize] = useState(''); // Added
    const [features, setFeatures] = useState('');
    const [description, setDescription] = useState(''); // Added

    // Location & Time
    const [lastSeenLocation, setLastSeenLocation] = useState('');
    const [region, setRegion] = useState(''); // Added (North/South/etc.)
    const [lat, setLat] = useState('25.0330');
    const [lng, setLng] = useState('121.5654');
    const [lostTime, setLostTime] = useState(new Date().toLocaleString('zh-TW', { hour12: false })); // Auto-fill time
    const [direction, setDirection] = useState('');

    // Behavior
    const [personality, setPersonality] = useState('');
    const [approachMethod, setApproachMethod] = useState('');

    // Contact
    const [contactName, setContactName] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [reward, setReward] = useState('');

    // ID
    const [collar, setCollar] = useState('');
    const [microchipId, setMicrochipId] = useState('');
    const [hasTag, setHasTag] = useState(false);

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

        if (id) {
            setLoading(true);
            fetch(`${API_URL}/api/reports/${id}`)
                .then(res => res.json())
                .then(data => {
                    setUserId(String(data.user_id));
                    setSpecies(data.species || 'dog');
                    setName(data.name || '');
                    setBreed(data.breed || '');
                    setSex(data.sex || 'unknown');
                    setAge(data.age || '');
                    setSize(data.size || ''); // Populating new state
                    setColor(data.color || '');
                    setFeatures(data.features || '');
                    setDescription(data.description || ''); // Populating new state
                    setLastSeenLocation(data.last_seen_location || '');
                    setRegion(data.region || ''); // Populating new state
                    setLostTime(data.lost_time || '');
                    setDirection(data.direction || '');
                    setPersonality(data.personality || '');
                    setApproachMethod(data.approach_method || '');
                    setCollar(data.collar || '');
                    setMicrochipId(data.microchip_id || '');
                    setHasTag(data.has_tag || false);
                    setContactName(data.contact_name || '');
                    setContactPhone(data.contact_phone || '');
                    setReward(data.reward || '');
                    if (data.image_path) {
                        setImages([`${API_URL}/${data.image_path}`.replace(/\\/g, '/')]);
                        // TODO: If API returns data.images list, mapped it here
                        if (data.images && data.images.length > 0) {
                            setImages(data.images.map((img: any) => `${API_URL}/${img.image_path}`.replace(/\\/g, '/')));
                        }
                    }
                    if (data.lat) setLat(data.lat.toString());
                    if (data.lng) setLng(data.lng.toString());
                })
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        } else {
            // Auto-fetch location for new reports
            if (navigator.geolocation) {
                setLastSeenLocation('正在取得定位...');
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        setLat(latitude.toString());
                        setLng(longitude.toString());
                        // Reverse Geocoding (Optional)
                        // fetch(`...`) 
                        setLastSeenLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                    },
                    (error) => {
                        console.log(error);
                        setLastSeenLocation('');
                        Alert.alert("定位失敗", "請手動輸入位置");
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
                );
            }
        }
    }, [id]);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5,
            aspect: [4, 3], // Aspect ratio might be ignored for multiple
            quality: 0.8,
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            setImages(prev => [...prev, ...newUris]);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const showAlert = (title: string, message: string) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}\n${message}`);
        } else {
            Alert.alert(title, message);
        }
    };

    const submitReport = async () => {
        if (images.length === 0) {
            showAlert('提醒', '請至少選擇一張照片');
            return;
        }

        // Grouped Validation
        const missingGroups = new Set<string>();

        // Basic Info Group
        if (!name || !breed || !sex || !age || !size || !features || !lastSeenLocation) {
            missingGroups.add('基本資料');
        }

        // Contact Info Group
        if (!contactName || !contactPhone) {
            missingGroups.add('聯絡資訊');
        }

        if (missingGroups.size > 0) {
            showAlert('資料不完整', `請填寫以下資訊：\n${Array.from(missingGroups).join('、')}`);
            return;
        }

        setLoading(true);

        const formData = new FormData();
        formData.append('user_id', userId);
        formData.append('lat', lat);
        formData.append('lng', lng);
        formData.append('species', species);
        formData.append('name', name);
        formData.append('breed', breed);
        formData.append('sex', sex);
        if (age) formData.append('age', age);
        if (size) formData.append('size', size); // Added

        formData.append('color', color);
        formData.append('features', features);
        if (description) formData.append('description', description); // Added

        formData.append('last_seen_location', lastSeenLocation);
        if (region) formData.append('region', region); // Added
        formData.append('lost_time', lostTime);
        formData.append('direction', direction);

        if (personality) formData.append('personality', personality);
        if (approachMethod) formData.append('approach_method', approachMethod);

        if (collar) formData.append('collar', collar);
        if (microchipId) formData.append('microchip_id', microchipId);
        formData.append('has_tag', hasTag.toString());

        formData.append('contact_name', contactName);
        formData.append('contact_phone', contactPhone);
        if (reward) formData.append('reward', reward);

        // Image Handling
        // Image Handling
        for (let i = 0; i < images.length; i++) {
            const imgUri = images[i];
            if (imgUri && !imgUri.startsWith('http')) {
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
        }

        try {
            const url = id ? `${API_URL}/api/reports/${id}` : `${API_URL}/api/reports/lost`;
            const method = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                body: formData,
            });

            if (response.ok) {
                // const data = await response.json(); 
                if (Platform.OS === 'web') {
                    window.alert('通報已送出');
                    router.replace('/(tabs)/finding');
                } else {
                    Alert.alert('成功', '通報已送出', [
                        { text: 'OK', onPress: () => router.replace('/(tabs)/finding') }
                    ]);
                }
            } else {
                console.error('Submit failed', await response.text());
                showAlert('錯誤', '送出失敗，請稍後再試');
            }
        } catch (error: any) {
            console.error(error);
            showAlert('錯誤', error.message);
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
                <View style={styles.navBar}>
                    <Pressable onPress={() => router.back()} style={styles.navButton}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </Pressable>
                    <Text style={styles.navTitle}>走失協尋</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                    <View style={styles.imageBox}>
                        {images.length > 0 ? (
                            <Image source={{ uri: images[0] }} style={styles.image} />
                        ) : (
                            <Pressable onPress={pickImage} style={styles.placeholder}>
                                <IconSymbol name="camera.fill" size={40} color="#ccc" />
                                <Text style={styles.placeholderText}>新增照片</Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Image Thumbnails */}
                    {images.length > 0 && (
                        <ScrollView horizontal style={styles.imageScroll} contentContainerStyle={styles.imageScrollContent}>
                            <Pressable onPress={pickImage} style={styles.addImageBox}>
                                <IconSymbol name="plus" size={30} color="#888" />
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
                    )}

                    <Text style={styles.sectionHeader}>📄 基本資料 (必填)</Text>

                    <Text style={styles.label}>物種</Text>
                    <View style={styles.row}>
                        {['dog', 'cat', 'other'].map(s => (
                            <Pressable key={s} onPress={() => setSpecies(s)} style={[styles.typeBtn, species === s && styles.activeType]}>
                                <Text style={[styles.typeText, species === s && styles.activeText]}>{s === 'dog' ? '狗' : (s === 'cat' ? '貓' : '其他')}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <Text style={styles.label}>名字 *</Text>
                    <TextInput style={styles.input} value={name} onChangeText={setName} />

                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>品種 *</Text>
                            <TextInput style={styles.input} value={breed} onChangeText={setBreed} />
                        </View>
                    </View>

                    <Text style={styles.label}>性別</Text>
                    <View style={styles.row}>
                        {['male', 'female', 'unknown'].map(s => (
                            <Pressable key={s} onPress={() => setSex(s)} style={[styles.typeBtn, sex === s && styles.activeType]}>
                                <Text style={[styles.typeText, sex === s && styles.activeText]}>{s === 'male' ? '公' : (s === 'female' ? '母' : '未知')}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <Text style={styles.label}>體型</Text>
                    <View style={styles.row}>
                        {['Small', 'Medium', 'Large'].map(s => (
                            <Pressable key={s} onPress={() => setSize(s)} style={[styles.typeBtn, size === s && styles.activeType]}>
                                <Text style={[styles.typeText, size === s && styles.activeText]}>{s}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <Text style={styles.label}>年齡 *</Text>
                    <TextInput style={styles.input} value={age} onChangeText={setAge} />

                    <Text style={styles.sectionHeader}>🎨 外觀特徵</Text>
                    <Text style={styles.label}>毛色</Text>
                    <TextInput style={styles.input} value={color} onChangeText={setColor} />

                    <Text style={styles.label}>顯著特徵 *</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={features}
                        onChangeText={setFeatures}
                        multiline
                    />

                    <Text style={styles.sectionHeader}>📍 時間與地點</Text>
                    <Text style={styles.label}>最後出現地點 *</Text>
                    <TextInput style={styles.input} value={lastSeenLocation} onChangeText={setLastSeenLocation} />

                    <Text style={styles.label}>走失時間</Text>
                    <TextInput style={styles.input} value={lostTime} onChangeText={setLostTime} />

                    <Text style={styles.label}>移動方向</Text>
                    <TextInput style={styles.input} value={direction} onChangeText={setDirection} />

                    <Text style={styles.sectionHeader}>🐕 性格與行為</Text>
                    <Text style={styles.label}>個性</Text>
                    <TextInput style={styles.input} value={personality} onChangeText={setPersonality} />

                    <Text style={styles.label}>靠近建議</Text>
                    <TextInput style={styles.input} value={approachMethod} onChangeText={setApproachMethod} />

                    <Text style={styles.sectionHeader}>🆔 配件與晶片</Text>
                    <Text style={styles.label}>項圈/胸背帶</Text>
                    <TextInput style={styles.input} value={collar} onChangeText={setCollar} />

                    <Text style={styles.label}>晶片號碼</Text>
                    <TextInput style={styles.input} value={microchipId} onChangeText={setMicrochipId} />

                    <View style={[styles.row, { alignItems: 'center', marginTop: 10 }]}>
                        <Text style={{ fontSize: 16, flex: 1 }}>是否有配戴名牌</Text>
                        <Switch value={hasTag} onValueChange={setHasTag} />
                    </View>

                    <Text style={styles.sectionHeader}>📞 聯絡資訊 (必填)</Text>
                    <Text style={styles.label}>聯絡人稱呼 *</Text>
                    <TextInput style={styles.input} value={contactName} onChangeText={setContactName} />

                    <Text style={styles.label}>聯絡電話 *</Text>
                    <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />

                    <Text style={styles.label}>賞金</Text>
                    <TextInput style={styles.input} value={reward} onChangeText={setReward} />

                    <View style={{ height: 20 }} />

                    <Pressable
                        onPress={submitReport}
                        disabled={loading}
                        style={({ pressed }) => [
                            styles.submitBtnWrap,
                            pressed && !loading && { transform: [{ scale: 0.99 }] },
                            loading && { opacity: 0.75 }
                        ]}
                    >
                        <LinearGradient
                            colors={['#FB7185', '#F43F5E']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.submitBtn}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane-outline" size={20} color="#FFF" />
                                    <View>
                                        <Text style={styles.submitBtnTitle}>送出走失通報</Text>
                                        <Text style={styles.submitBtnSub}>確認資料後立即發布協尋</Text>
                                    </View>
                                </>
                            )}
                        </LinearGradient>
                    </Pressable>
                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 }, // Removed white bg

    // Background Bubbles
    bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
    bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
    b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
    b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
    b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },
    b4: { width: 200, height: 200, right: 20, bottom: 100, backgroundColor: "#e2f6ff" },

    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        // borderBottomWidth: 1,
        // borderBottomColor: '#eee',
        backgroundColor: 'transparent',
        paddingTop: Platform.OS === 'android' ? 40 : 50, // Increased for iOS safe area
        zIndex: 10,
        // elevation: 2
    },
    navButton: {
        padding: 8,
        zIndex: 11,
        backgroundColor: '#FFF', borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    navTitle: { fontSize: 20, fontWeight: '900', color: '#1F1F2A' },
    title: { display: 'none' }, // Build title into nav bar instead
    sectionHeader: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 15, color: '#333', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
    imageBox: {
        width: '100%', height: 200, backgroundColor: '#eee', borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden'
    },
    imageScroll: { maxHeight: 120, marginBottom: 20 },
    imageScrollContent: { alignItems: 'center', paddingRight: 20 },
    addImageBox: { width: 100, height: 100, borderRadius: 10, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed' },
    imageContainer: { position: 'relative', marginRight: 15 },
    thumbnail: { width: 100, height: 100, borderRadius: 10 },
    removeBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: 'white', borderRadius: 12 },

    // Existing styles
    image: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholder: { alignItems: 'center' },
    placeholderText: { color: '#888' },
    label: { fontSize: 14, fontWeight: '600', marginTop: 10, marginBottom: 5, color: '#555' },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 5, fontSize: 16, backgroundColor: 'rgba(255,255,255,0.8)' }, // Translucent input
    textArea: { height: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row', gap: 10, marginBottom: 5 },
    typeBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
    activeType: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
    typeText: { color: '#333' },
    activeText: { color: 'white', fontWeight: 'bold' },
    submitBtnWrap: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: "#F43F5E",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 8
    },
    submitBtn: {
        minHeight: 62,
        borderRadius: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10
    },
    submitBtnTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800'
    },
    submitBtnSub: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 12,
        marginTop: 2
    },
});
