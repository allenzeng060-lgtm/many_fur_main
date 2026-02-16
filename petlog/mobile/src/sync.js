// mobile/src/sync.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const QUEUE_KEY = "petlog_offline_queue_v1";

// queue item 格式：
// { id, op, ts, payload }
// op: "CREATE_EVENT" | "DELETE_EVENT" | (未來可加 "CREATE_PET" "DELETE_PET" etc.)

function nowISO() {
  return new Date().toISOString();
}

function makeId() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function getQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function setQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueOp({ op, payload }) {
  const q = await getQueue();
  q.push({ id: makeId(), op, ts: nowISO(), payload });
  await setQueue(q);
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// ✅ 正常在線：你可以不呼叫這個
// ✅ 備援：網路恢復後，將離線操作重送
export async function syncNow() {
  const q = await getQueue();
  if (!q.length) return { pushed: 0, remaining: 0 };

  const remaining = [];
  let pushed = 0;

  for (const item of q) {
    try {
      if (item.op === "CREATE_EVENT") {
        const { petId, event } = item.payload;
        await api.createEvent(petId, event);
        pushed += 1;
      } else if (item.op === "DELETE_EVENT") {
        const { eventId } = item.payload;
        await api.deleteEvent(eventId);
        pushed += 1;
      } else {
        // 未認得的 op：保留
        remaining.push(item);
      }
    } catch (e) {
      // 送失敗：保留在 queue
      remaining.push(item);
    }
  }

  await setQueue(remaining);
  return { pushed, remaining: remaining.length };
}

// 兼容舊名稱與簡易 API
export const enqueue = async (item) => {
  // 如果直接傳 { op, ...payloadFields }
  if (item && typeof item === "object" && "op" in item) {
    const { op, ...rest } = item;
    await enqueueOp({ op, payload: rest });
    return;
  }
  // 否則嘗試當作 enqueueOp 的參數
  await enqueueOp(item);
};

export const syncAll = syncNow;

export async function syncAllSafe() {
  try {
    return await syncNow();
  } catch (e) {
    return { pushed: 0, remaining: 0, error: String(e) };
  }
}
