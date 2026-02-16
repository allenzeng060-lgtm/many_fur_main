import React, { useState } from "react";
import {
    Alert,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from '@react-native-community/datetimepicker';

const BASE_URL = "http://127.0.0.1:8000";
const CID_KEY = "petlog_client_id";

async function getClientId() {
    let cid = await AsyncStorage.getItem(CID_KEY);
    if (!cid) {
        // Should already exist if we are adding a plan
        throw new Error("No client ID found");
    }
    return cid;
}

async function api(path: string, opts: RequestInit = {}) {
    const cid = await getClientId();
    const res = await fetch(`${BASE_URL}${path}`, {
        ...opts,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Client-Id": cid,
            ...(opts.headers || {}),
        },
    });

    const text = await res.text();
    let data: any = null;
    try {
        data = JSON.parse(text);
    } catch { }

    if (!res.ok) {
        const msg =
            (data && (data.detail || data.message || data.error)) ||
            text ||
            res.statusText;
        throw new Error(`${res.status} ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }
    return data ?? text;
}

export default function AddCarePlanScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [name, setName] = useState("");
    const [interval, setInterval] = useState("365");
    const [lastDate, setLastDate] = useState("");
    const [saving, setSaving] = useState(false);

    // Date picker states
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);


    const handleDateChange = (event: any, date?: Date) => {
        setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
        if (date) {
            setSelectedDate(date);
            // Format date as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            setLastDate(`${year}-${month}-${day}`);
        }
    };

    const submit = async () => {
        if (!name.trim()) {
            Alert.alert("提醒", "計畫名稱必填");
            return;
        }
        const days = parseInt(interval);
        if (isNaN(days) || days <= 0) {
            Alert.alert("提醒", "週期天數必須是正整數");
            return;
        }

        // No need to validate date format - DatePicker ensures it's valid

        setSaving(true);
        try {
            // Generate code from name (lowercase, replace spaces with underscores)
            const code = name.trim().toLowerCase().replace(/\s+/g, '_');

            const payload = {
                code: code,
                name: name.trim(),
                category: "custom",
                interval_days: days,
                last_date: lastDate.trim() ? lastDate.trim() : null,
            };
            await api(`/pets/${id}/care-plans`, { method: "POST", body: JSON.stringify(payload) });
            router.back();
        } catch (e: any) {
            Alert.alert("新增失敗", e?.message || String(e));
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backText}>返回</Text>
                </Pressable>
                <Text style={styles.h1}>新增照護計畫</Text>
            </View>

            <View style={styles.form}>
                <Text style={styles.label}>計畫名稱（必填）</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例如：施打狂犬病疫苗" />

                <Text style={styles.label}>週期（天）</Text>
                <TextInput
                    style={styles.input}
                    value={interval}
                    onChangeText={setInterval}
                    keyboardType="numeric"
                    placeholder="365"
                />

                <Text style={styles.label}>上次日期（可選）</Text>
                <Pressable
                    style={styles.datePickerButton}
                    onPress={() => setShowDatePicker(true)}
                >
                    <Text style={lastDate ? styles.dateText : styles.datePlaceholder}>
                        {lastDate || "點擊選擇日期"}
                    </Text>
                </Pressable>

                {showDatePicker && (
                    <DateTimePicker
                        value={selectedDate || new Date()}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'inline' : 'default'}
                        onChange={handleDateChange}
                        locale="zh-TW"
                    />
                )}

                <Pressable style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
                    <Text style={styles.submitText}>{saving ? "送出中…" : "新增計畫"}</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fbfaff" },
    header: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
    backBtn: {
        alignSelf: "flex-start",
        backgroundColor: "rgba(0,0,0,.06)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        marginBottom: 10,
    },
    backText: { color: "#1f1f2a", fontWeight: "900" },
    h1: { fontSize: 22, fontWeight: "900", color: "#1f1f2a" },

    form: { padding: 14 },
    label: { marginTop: 12, marginBottom: 6, fontWeight: "900", color: "#1f1f2a" },
    input: {
        backgroundColor: "white",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "rgba(25,25,45,.10)",
    },
    submitBtn: {
        marginTop: 18,
        backgroundColor: "#1f1f2a",
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
    },
    submitText: { color: "white", fontWeight: "900", fontSize: 16 },

    datePickerButton: {
        backgroundColor: "white",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: "rgba(25,25,45,.10)",
    },
    dateText: {
        color: "#1f1f2a",
        fontSize: 16,
    },
    datePlaceholder: {
        color: "#999",
        fontSize: 16,
    },
});
