import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { API_URL } from '@/constants/config';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("錯誤", "請輸入 Email 和密碼");
            return;
        }

        setLoading(true);
        try {
            // 1. 登入取得 Token
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "登入失敗");

            const token = data.access_token;
            await AsyncStorage.setItem('auth_token', token);

            // 2. 取得使用者資料
            const meRes = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const meData = await meRes.json();

            await AsyncStorage.setItem('user_info', JSON.stringify(meData));

            Alert.alert("登入成功", `歡迎回來，${meData.name}！`, [
                { text: "開始使用", onPress: () => router.replace('/(tabs)/profile') }
            ]);

        } catch (e: any) {
            Alert.alert("登入失敗", e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGuestLogin = async () => {
        try {
            const guestUser = {
                id: 'guest',
                email: 'guest@example.com',
                name: '訪客',
                avatar_url: null,
                is_guest: true
            };

            await AsyncStorage.setItem('auth_token', 'guest_token');
            await AsyncStorage.setItem('user_info', JSON.stringify(guestUser));

            Alert.alert("訪客模式", "您現在以訪客身份瀏覽，部分功能將受限。", [
                { text: "好的", onPress: () => router.replace('/(tabs)/finding') }
            ]);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            {/* Background Bubbles */}
            <View pointerEvents="none" style={styles.bg}>
                <View style={[styles.bubble, styles.b1]} />
                <View style={[styles.bubble, styles.b2]} />
                <View style={[styles.bubble, styles.b3]} />
            </View>



            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="paw" size={40} color="#4F46E5" />
                    </View>
                    <Text style={styles.appName}>毛很多</Text>
                    <Text style={styles.appSlogan}>搞定毛孩大小事</Text>
                </View>

                {/* Glassmorphism Card */}
                <View style={styles.formCard}>
                    <Text style={styles.cardTitle}>會員登入</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="輸入您的 Email"
                            placeholderTextColor="#9CA3AF"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>密碼</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="輸入您的密碼"
                            placeholderTextColor="#9CA3AF"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>登入帳號</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.btn, styles.guestBtn]} onPress={handleGuestLogin} disabled={loading}>
                        <Text style={[styles.btnText, styles.guestBtnText]}>訪客試用</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/auth/register')}>
                        <Text style={styles.linkText}>還沒有帳號？ <Text style={{ fontWeight: 'bold', color: '#4F46E5' }}>立即註冊</Text></Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fbfaff' },

    // Background Bubbles
    bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fbfaff" },
    bubble: { position: "absolute", borderRadius: 9999, opacity: 0.28 },
    b1: { width: 320, height: 320, left: -100, top: -50, backgroundColor: "#e9dfff" },
    b2: { width: 220, height: 220, right: -50, top: 100, backgroundColor: "#ffd6e6" },
    b3: { width: 260, height: 260, left: 40, bottom: -50, backgroundColor: "#e7e2ff" },

    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

    content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', marginTop: -60 },

    logoContainer: { alignItems: 'center', marginBottom: 32 },
    logoCircle: { width: 80, height: 80, backgroundColor: '#FFF', borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#623eff', shadowOpacity: 0.15, shadowRadius: 16, elevation: 5 },
    appName: { fontSize: 28, fontWeight: '900', color: '#1F1F2A' },
    appSlogan: { fontSize: 16, color: '#6B7280', marginTop: 4, fontWeight: '600' },

    formCard: {
        backgroundColor: "rgba(255,255,255,0.9)",
        borderRadius: 24,
        padding: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,1)",
    },
    cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F1F2A', marginBottom: 24, textAlign: 'center' },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 14, color: '#374151', marginBottom: 8, fontWeight: '700' },
    input: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, fontSize: 16, color: '#1F2937' },

    btn: { backgroundColor: '#1F1F2A', borderRadius: 18, padding: 18, alignItems: 'center', marginTop: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    guestBtn: { backgroundColor: '#F3F4F6', marginTop: 16, elevation: 0 },
    guestBtnText: { color: '#666' },

    linkBtn: { marginTop: 24, alignItems: 'center' },
    linkText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
});
