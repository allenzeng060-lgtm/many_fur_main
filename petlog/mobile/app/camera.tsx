import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform, Alert, ActivityIndicator, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || "gpt-4o-mini";
const { width } = Dimensions.get('window');

const PERSONALITIES = [
    { id: 'random', label: '🎲 隨機', prompt: '語氣隨機，可能是可愛、傲嬌或慵懶，請根據照片氛圍自由發揮。' },
    { id: 'tsundere', label: '😤 傲嬌', prompt: '語氣要非常「傲嬌」，口嫌體正直，明明喜歡卻裝作不在乎，稱呼人類為「僕人」或「笨蛋」。' },
    { id: 'cute', label: '🥰 呆萌', prompt: '語氣要超級「呆萌、傻乎乎」，只知道吃和玩，用詞簡單可愛，充滿愛心。' },
    { id: 'uncle', label: '🍺 大叔', prompt: '語氣像個「中年大叔」，慵懶、愛發牢騷、喜歡說教，覺得年輕人(人類)很麻煩。' },
    { id: 'chunibyo', label: '⚡ 中二', prompt: '語氣要有嚴重的「中二病 (Chunibyo)」，以為自己有超能力或被封印的黑暗力量，講話戲劇化。' },
    { id: 'elegant', label: '👑 優雅', prompt: '語氣要像個「貴族或女王」，高貴優雅，看不起庶民，用詞華麗。' },
];

const QUOTA_COOLDOWN_MS = 60_000;

const FALLBACK_THOUGHTS: Record<string, string[]> = {
    random: [
        "今天只想黏著你，哪裡都不去。",
        "先來罐罐，再談人生理想。",
        "我剛剛其實在觀察你的零食。"
    ],
    tsundere: [
        "才不是想你，只是路過看一下笨蛋。",
        "別誤會，我只是順便靠近你而已。",
        "哼，我才沒有在等你摸摸。"
    ],
    cute: [
        "今天的我想被抱抱和摸摸。",
        "我最喜歡你陪我玩了。",
        "肚子有點餓，可以加餐嗎？"
    ],
    uncle: [
        "年輕人，罐罐該補貨了吧。",
        "今天先休息，別讓我跑太多。",
        "我看你很閒，來幫我梳毛。"
    ],
    chunibyo: [
        "封印解除，今晚我將巡邏全屋。",
        "黑暗之力告訴我：該開罐罐了。",
        "凡人，快呈上今日的供品。"
    ],
    elegant: [
        "本王今日心情尚可，准你服侍。",
        "請保持安靜，我在沉思宇宙。",
        "下午茶時間到了，安排一下。"
    ],
};

export default function CameraScreen() {
    const router = useRouter();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [base64Data, setBase64Data] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedPersonality, setSelectedPersonality] = useState('random');
    const [quotaCooldownUntil, setQuotaCooldownUntil] = useState(0);

    useEffect(() => {
        (async () => {
            if (Platform.OS === 'web') {
                setHasPermission(true);
                return;
            }
            try {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                setHasPermission(status === 'granted');
            } catch (e) {
                console.error('Permission Error', e);
                setHasPermission(false);
            }
        })();
    }, []);

    const convertBlobToBase64 = async (blobUrl: string): Promise<string> => {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const openCamera = async () => {
        if (isProcessing || isAnalyzing) return;
        setIsProcessing(true);
        try {
            if (Platform.OS === 'web') {
                handleWebInput(true);
            } else {
                const result = await ImagePicker.launchCameraAsync({
                    allowsEditing: false,
                    quality: 0.3,
                    base64: true,
                });
                handleImageResult(result);
            }
        } catch (err) {
            console.error(err);
            Alert.alert('錯誤', '無法開啟相機');
        } finally {
            setIsProcessing(false);
        }
    };

    const pickImageFromLibrary = async () => {
        if (isProcessing || isAnalyzing) return;
        setIsProcessing(true);
        try {
            if (Platform.OS === 'web') {
                handleWebInput(false);
            } else {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: false,
                    quality: 0.3,
                    base64: true,
                });
                handleImageResult(result);
            }
        } catch (err) {
            console.error(err);
            Alert.alert('錯誤', '無法開啟相簿');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
        if (!result.canceled) {
            const asset = result.assets[0];
            setImageUri(asset.uri);
            if (asset.base64) setBase64Data(asset.base64);
            setSelectedPersonality('random');
        }
    };

    const handleWebInput = (useCamera: boolean) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (useCamera) input.capture = 'environment';
        input.onchange = async () => {
            const file = input.files && input.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                setImageUri(url);
                const b64 = await convertBlobToBase64(url);
                setBase64Data(b64);
                setSelectedPersonality('random');
            }
        };
        input.click();
    };

    const analyzeWithAI = async () => {
        if (!imageUri || !base64Data) return;
        if (!OPENAI_API_KEY) {
            const msg = "請先設定 EXPO_PUBLIC_OPENAI_API_KEY 環境變數";
            Platform.OS === 'web' ? alert(msg) : Alert.alert("設定錯誤", msg);
            return;
        }
        const isPlaceholderKey =
            /^YOUR_/i.test(OPENAI_API_KEY) ||
            OPENAI_API_KEY.includes("YOUR_OPENAI_API_KEY");
        if (isPlaceholderKey) {
            const msg = "目前使用的是範例金鑰，請改成你的 OpenAI API Key，並重新啟動 Expo。";
            Platform.OS === 'web' ? alert(msg) : Alert.alert("設定錯誤", msg);
            return;
        }
        if (Date.now() < quotaCooldownUntil) {
            const remainSec = Math.ceil((quotaCooldownUntil - Date.now()) / 1000);
            const msg = `AI 服務稍忙，請 ${remainSec} 秒後再試`;
            Platform.OS === 'web' ? alert(msg) : Alert.alert("稍後再試", msg);
            return;
        }

        setIsAnalyzing(true);
        try {
            const personalityConfig = PERSONALITIES.find(p => p.id === selectedPersonality) || PERSONALITIES[0];
            const personalityPrompt = personalityConfig.prompt;

            const prompt = `請扮演這隻寵物，用一句繁體中文簡短描述你現在的心情或想法（30字以內）。${personalityPrompt} 請根據照片中的動作或表情發揮。`;
            const requestBody = {
                model: OPENAI_MODEL,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: { url: `data:image/jpeg;base64,${base64Data}` }
                            }
                        ]
                    }
                ],
                max_tokens: 120
            };

            const response = await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errMsg = data?.error?.message || `API Error (${response.status})`;
                const isQuotaError =
                    response.status === 429 ||
                    /resource exhausted|quota|429|rate limit/i.test(String(errMsg));
                const isAuthError =
                    response.status === 401 ||
                    /incorrect api key|invalid api key|authentication/i.test(String(errMsg));

                if (isAuthError) {
                    const msg = "OpenAI API Key 無效或已過期，請更新 EXPO_PUBLIC_OPENAI_API_KEY 後重啟 App。";
                    Platform.OS === 'web' ? alert(msg) : Alert.alert("金鑰錯誤", msg);
                    return;
                }

                if (isQuotaError) {
                    setQuotaCooldownUntil(Date.now() + QUOTA_COOLDOWN_MS);
                    const pool = FALLBACK_THOUGHTS[selectedPersonality] || FALLBACK_THOUGHTS.random;
                    const fallbackText = pool[Math.floor(Math.random() * pool.length)];
                    const msg = "AI 服務暫時達到使用上限，先用備援讀心文案呈現。";
                    if (Platform.OS === 'web') {
                        alert(msg);
                        router.push(`/modal?imageUri=${encodeURIComponent(imageUri)}&analysis=${encodeURIComponent(fallbackText)}`);
                    } else {
                        Alert.alert("系統忙碌", msg, [
                            {
                                text: "了解",
                                onPress: () => router.push({ pathname: '/modal', params: { imageUri, analysis: fallbackText } })
                            }
                        ]);
                    }
                    return;
                }
                throw new Error(errMsg);
            }

            const aiText = data?.choices?.[0]?.message?.content?.trim() || "（發呆中...）";

            if (Platform.OS === 'web') {
                router.push(`/modal?imageUri=${encodeURIComponent(imageUri)}&analysis=${encodeURIComponent(aiText)}`);
            } else {
                router.push({ pathname: '/modal', params: { imageUri, analysis: aiText } });
            }

        } catch (error: any) {
            console.error(error);
            const msg = error?.message || "未知錯誤";
            Platform.OS === 'web' ? alert(msg) : Alert.alert("分析失敗", msg);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const retake = () => {
        setImageUri(null);
        setBase64Data(null);
    };

    return (
        <View style={styles.container}>
            {/* 背景光暈 (複製自 Home Screen) */}
            <View pointerEvents="none" style={styles.bg}>
                <View style={[styles.bubble, styles.b1]} />
                <View style={[styles.bubble, styles.b2]} />
                <View style={[styles.bubble, styles.b3]} />
            </View>

            <SafeAreaView edges={['top']} style={styles.safeArea}>
                {/* 導航列 */}
                <View style={styles.navBar}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back-ios" size={20} color="#1f1f2a" />
                    </TouchableOpacity>
                </View>

                {/* Header 內容 */}
                <View style={styles.headerContent}>
                    <View style={styles.iconCircle}>
                        <MaterialIcons name="pets" size={36} color="#623eff" />
                    </View>
                    <Text style={styles.title}>AI 讀心術</Text>
                    <Text style={styles.subtitle}>拍下毛孩，聽聽牠的心聲</Text>
                </View>

                <View style={styles.body}>
                    {imageUri ? (
                        <View style={styles.previewContainer}>
                            <View style={styles.imageCard}>
                                <Image source={{ uri: imageUri }} style={styles.preview} />
                            </View>

                            {!isAnalyzing && (
                                <View style={styles.personalityContainer}>
                                    <Text style={styles.sectionLabel}>選擇牠的個性：</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
                                        {PERSONALITIES.map((p) => (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={[
                                                    styles.chip,
                                                    selectedPersonality === p.id && styles.chipSelected
                                                ]}
                                                onPress={() => setSelectedPersonality(p.id)}
                                            >
                                                <Text style={[
                                                    styles.chipText,
                                                    selectedPersonality === p.id && styles.chipTextSelected
                                                ]}>
                                                    {p.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            <View style={styles.buttonsRow}>
                                {isAnalyzing ? (
                                    <View style={styles.loadingCard}>
                                        <ActivityIndicator size="small" color="#623eff" />
                                        <Text style={styles.loadingText}>正在感應腦波...</Text>
                                    </View>
                                ) : (
                                    <>
                                        <TouchableOpacity style={styles.circleButton} onPress={retake}>
                                            <MaterialIcons name="refresh" size={24} color="#6b6b7a" />
                                        </TouchableOpacity>

                                        <TouchableOpacity style={styles.analyzeButton} onPress={analyzeWithAI}>
                                            <MaterialIcons name="auto-awesome" size={24} color="#FFF" />
                                            <Text style={styles.analyzeButtonText}>開始分析</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.actionCard} onPress={openCamera} disabled={isProcessing}>
                                <View style={[styles.cardIconBox, { backgroundColor: '#e7e2ff' }]}>
                                    <MaterialIcons name="camera-alt" size={32} color="#623eff" />
                                </View>
                                <View style={styles.cardTextBox}>
                                    <Text style={styles.cardTitle}>拍攝照片</Text>
                                    <Text style={styles.cardSubtitle}>捕捉可愛瞬間</Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={24} color="#d4d4d8" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionCard} onPress={pickImageFromLibrary} disabled={isProcessing}>
                                <View style={[styles.cardIconBox, { backgroundColor: '#ffeaf2' }]}>
                                    <MaterialIcons name="photo-library" size={32} color="#ff6b8f" />
                                </View>
                                <View style={styles.cardTextBox}>
                                    <Text style={styles.cardTitle}>從相簿選擇</Text>
                                    <Text style={styles.cardSubtitle}>找回舊的回憶</Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={24} color="#d4d4d8" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fbfaff" },

    // Background Bubbles
    bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
    bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
    b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
    b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
    b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },

    safeArea: { flex: 1 },

    navBar: {
        width: '100%',
        height: 50,
        justifyContent: 'center',
        paddingHorizontal: 20,
        zIndex: 100,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: "rgba(98,62,255,.1)",
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },

    headerContent: { alignItems: 'center', marginTop: 0, paddingBottom: 30 },
    iconCircle: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        borderWidth: 1, borderColor: "rgba(98,62,255,.15)",
        shadowColor: '#623eff', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8
    },
    title: { fontSize: 26, fontWeight: '900', color: '#1f1f2a', marginBottom: 6 },
    subtitle: { fontSize: 15, color: '#6b6b7a', fontWeight: '600' },

    body: { flex: 1, width: '100%' },

    // Action Cards (Redesigned to match Home)
    actions: { width: '100%', paddingHorizontal: 24, gap: 16, justifyContent: 'center', flex: 1, marginTop: -60 },
    actionCard: {
        width: '100%',
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: "rgba(98,62,255,.08)",
        shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 4
    },
    cardIconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    cardTextBox: { flex: 1 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: '#1f1f2a', marginBottom: 4 },
    cardSubtitle: { fontSize: 13, color: '#9ca3af', fontWeight: '500' },

    // Preview UI
    previewContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
    imageCard: {
        width: width - 48, height: width - 48,
        borderRadius: 28, overflow: 'hidden', backgroundColor: '#fff', marginBottom: 24,
        borderWidth: 4, borderColor: '#FFF',
        shadowColor: '#623eff', shadowOpacity: 0.2, shadowRadius: 16, elevation: 10
    },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },

    personalityContainer: { width: '100%', marginBottom: 24 },
    sectionLabel: { fontSize: 15, color: '#6b6b7a', marginBottom: 12, marginLeft: 4, fontWeight: '700' },
    chipsScroll: { paddingHorizontal: 4, paddingBottom: 10 },
    chip: {
        paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99,
        backgroundColor: '#FFF', marginRight: 10,
        borderWidth: 1, borderColor: '#e7e2ff',
    },
    chipSelected: {
        backgroundColor: '#623eff', borderColor: '#623eff', shadowColor: '#623eff', shadowOpacity: 0.3, shadowRadius: 6, elevation: 4
    },
    chipText: { fontSize: 14, color: '#6b6b7a', fontWeight: '600' },
    chipTextSelected: { color: '#FFF' },

    buttonsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, width: '100%', marginTop: 'auto', marginBottom: 40 },
    circleButton: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#e4e4e7'
    },
    analyzeButton: {
        flex: 1, flexDirection: 'row', height: 56,
        backgroundColor: '#1f1f2a', borderRadius: 28,
        alignItems: 'center', justifyContent: 'center', gap: 8,
        shadowColor: '#1f1f2a', shadowOpacity: 0.2, shadowRadius: 10, elevation: 6
    },
    analyzeButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },

    loadingCard: {
        flex: 1, flexDirection: 'row', backgroundColor: '#FFF', height: 56,
        paddingHorizontal: 20, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 12,
        borderWidth: 1, borderColor: '#e4e4e7'
    },
    loadingText: { color: '#6b6b7a', fontSize: 15, fontWeight: '600' }
});
