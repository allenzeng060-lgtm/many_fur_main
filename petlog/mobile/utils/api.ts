import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { authEvents } from './auth-events';

// Use localhost for iOS simulator, or local IP for real device
// You might need to change this if testing on device
// 優先使用環境變數，否則使用 localhost
// 暫時改成開發機 LAN IP (若已在 .env 設定 EXPO_PUBLIC_API_URL 則以該值為主)
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.28:8000';

export const api = {
    async get(endpoint: string) {
        const token = await AsyncStorage.getItem('auth_token');
        let cid = await AsyncStorage.getItem('petlog_client_id');
        if (!cid) {
            cid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                const v = c === "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            });
            await AsyncStorage.setItem('petlog_client_id', cid);
        }

        const headers: any = {
            'Content-Type': 'application/json',
            'X-Client-Id': cid
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}${endpoint}`, { headers });
        return handleResponse(res);
    },

    async post(endpoint: string, body: any) {
        const token = await AsyncStorage.getItem('auth_token');
        const cid = await AsyncStorage.getItem('petlog_client_id');
        const headers: any = {
            'Content-Type': 'application/json',
            'X-Client-Id': cid // Should exist from get or be created, but for robustness we rely on get calls first or existing logic, or just send if exists. 
            // Actually, let's just create it if missing to be safe, but duplicates logic. 
            // For now, let's assume it exists or send it if we have it. 
        };
        if (cid) headers['X-Client-Id'] = cid;
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });
        return handleResponse(res);
    },

    async patch(endpoint: string, body: any) {
        const token = await AsyncStorage.getItem('auth_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(body)
        });
        return handleResponse(res);
    },

    async delete(endpoint: string) {
        const token = await AsyncStorage.getItem('auth_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_URL}${endpoint}`, {
            method: 'DELETE',
            headers
        });
        return handleResponse(res);
    },

    async updateProfile(body: { name?: string; avatar_url?: string; password?: string }) {
        return this.patch('/auth/me', body);
    }
};

async function handleResponse(res: Response) {
    if (res.status === 401) {
        // Token expired or invalid
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('user_info');

        // Notify app to redirect to login
        authEvents.emitLogout();

        // Optional: clear any other state if needed

        throw new Error("Unauthorized");
    }

    const data = await res.json();
    if (!res.ok) {
        let msg = data.detail || data.message || "API Request Failed";
        if (typeof msg === 'object') {
            msg = JSON.stringify(msg);
        }
        throw new Error(msg);
    }
    return data;
}
