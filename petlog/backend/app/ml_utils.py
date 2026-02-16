from __future__ import annotations

import json
import logging
import os
import cv2
import numpy as np
import PIL.Image
from dotenv import load_dotenv
import base64
from io import BytesIO
import math
from difflib import SequenceMatcher

load_dotenv()

# 配置
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("⚠️ Warning: GEMINI_API_KEY not found in environment variables.")

# 確保路徑正確：優先使用環境變數 `YOLO_WEIGHTS`，否則使用 repo 中的 yolov8n.pt
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
YOLO_WEIGHTS = os.getenv("YOLO_WEIGHTS") or str(PROJECT_ROOT / "yolov8n.pt")

# 初始化
_yolo_model = None
_zhipu_client = None

def get_yolo_model():
    global _yolo_model
    from ultralytics import YOLO  # Lazy import
    if _yolo_model is None:
        if os.path.exists(YOLO_WEIGHTS):
            print(f"🚀 Loading YOLO from {YOLO_WEIGHTS}")
            _yolo_model = YOLO(YOLO_WEIGHTS)
        else:
            print(f"❌ YOLO weights not found at {YOLO_WEIGHTS}")
            # Fallback or raise? For now let's hope it exists or use standard yolov8n
            _yolo_model = YOLO("yolov8n.pt") 
    return _yolo_model

def get_zhipu_client():
    global _zhipu_client
    # 檢查 API key 前先不要匯入 zhipuai，避免在缺少套件或無 key 時拋錯
    api_key = os.getenv("ZHIPUAI_API_KEY")
    if not api_key:
        print("⚠️ Warning: ZHIPUAI_API_KEY not found in environment variables.")
        return None

    try:
        from zhipuai import ZhipuAI  # Lazy import after checking API key
    except Exception as e:
        print(f"Failed to import zhipuai: {e}")
        return None

    if _zhipu_client is None:
        _zhipu_client = ZhipuAI(api_key=api_key)

    return _zhipu_client


def get_best_crop(original_img):
    """
    執行 YOLO，並回傳『畫面佔比最大』的那隻寵物的裁切圖。
    回傳: (crop_img, label_name) 或 (None, None)
    """
    model = get_yolo_model()
    try:
        results = model.predict(original_img, conf=0.25, save=False, verbose=False)
    except Exception as e:
        print(f"YOLO predict error: {e}")
        return None, None
    
    if not results or len(results[0].boxes) == 0:
        return None, None

    best_box = None
    best_area = 0
    best_label = "unknown"

    # 找出最大隻的那個 (假設是主角)
    for box in results[0].boxes:
        # 取得座標
        xyxy = box.xyxy[0].cpu().numpy().astype(int)
        x1, y1, x2, y2 = xyxy
        
        # 計算面積
        area = (x2 - x1) * (y2 - y1)
        
        # 取得類別 (根據你的訓練模型調整，這裡假設 0=cat, 1=dog 如同 user code)
        cls_id = int(box.cls[0])
        label = model.names[cls_id] # 直接用 model 的 names

        # 更新最大目標
        if area > best_area:
            best_area = area
            best_box = (x1, y1, x2, y2)
            best_label = label

    # 進行裁切
    if best_box:
        x1, y1, x2, y2 = best_box
        # 加上邊界檢查，防止切爆
        h, w, _ = original_img.shape
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        
        crop_img = original_img[y1:y2, x1:x2]
        return crop_img, best_label
    
    return None, None


def analyze_with_glm(crop_img_cv2):
    """
    將 OpenCV 圖片轉給 GLM-4V 進行特徵分析
    """
    client = get_zhipu_client()
    if not client:
         return {
            "species": "unknown",
            "features": "API Key Missing",
            "description": "Please set ZHIPUAI_API_KEY in .env"
        }
    
    # 1. OpenCV (BGR) -> PIL (RGB) -> Base64
    color_converted = cv2.cvtColor(crop_img_cv2, cv2.COLOR_BGR2RGB)
    pil_image = PIL.Image.fromarray(color_converted)
    
    buffered = BytesIO()
    pil_image.save(buffered, format="JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')

    # 2. 定義 Prompt
    prompt = """
    你是一位專業的動物特徵鑑識專家。請使用 **繁體中文** 分析這張圖片，回傳 JSON。
    請特別觀察：
    1. **物種 (species)**: 狗 (dog) / 貓 (cat) / 其他 (other)
    2. **品種 (breed)**: 例如 柴犬、米克斯、黃金獵犬
    3. **體型 (size)**: 小型 (Small) / 中型 (Medium) / 大型 (Large)
    4. **毛色 (color)**: 例如 黃白色、虎斑
    5. **性別 (sex)**: 公 / 母 / 未知
    6. **特徵 (distinctive_features)**: 越詳細越好，例如 "紅色項圈"、"立耳"、"麒麟尾"、"右前腳受傷"
    7. **其他 (others)**: 補充說明

    格式範例：
    {
        "species": "dog",
        "breed": "柴犬",
        "size": "Medium",
        "color": "黃白色",
        "sex": "疑似公",
        "distinctive_features": ["紅色項圈", "立耳"],
        "others": "看起來很乾淨"
    }
    請只回傳 JSON，不要有其他說明文字。
    """

    # 3. 呼叫 API (GLM-4.6V-Flash)
    try:
        response = client.chat.completions.create(
            model="glm-4.6v-flash", # Corrected to 4.6v-flash 
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_base64}"
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
        )
        
        # 4. 清洗 JSON
        text = response.choices[0].message.content.strip()
        if text.startswith("```json"):
            text = text.replace("```json", "").replace("```", "")
        elif text.startswith("```"):
            text = text.replace("```", "")
            
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            print(f"JSON Decode Error. Raw text: {text}")
            return {
                "species": "unknown",
                "features": "AI 回傳格式錯誤",
                "description": text[:100]
            }
        
        # 5. Convert to Traditional Chinese using OpenCC
        try:
            from opencc import OpenCC
            cc = OpenCC('s2t') # Simplified to Traditional
            
            def convert_recursive(item):
                if isinstance(item, str):
                    return cc.convert(item)
                elif isinstance(item, list):
                    return [convert_recursive(i) for i in item]
                elif isinstance(item, dict):
                    return {k: convert_recursive(v) for k, v in item.items()}
                return item
                
            data = convert_recursive(data)
        except ImportError:
            print("OpenCC not found, skipping conversion")
        except Exception as e:
            print(f"OpenCC conversion error: {e}")
        
        # Map to DB model fields
        features_list = data.get("distinctive_features", [])
        if isinstance(features_list, list):
            features_str = ", ".join([str(f) for f in features_list])
        else:
            features_str = str(features_list) if features_list else None
            
        return {
            "species": data.get("species", "unknown"),
            "breed": data.get("breed"),
            "size": data.get("size"), # Captured Size
            "color": data.get("color"),
            "sex": data.get("sex"),
            "features": features_str,  # Mapped from distinctive_features
            "description": data.get("others") # Mapped from others
        }

    except Exception as e:
        print(f"GLM-4V Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "species": "unknown",
            "breed": None, 
            "color": None, 
            "sex": None, 
            "features": "AI 分析失敗", 
            "description": str(e)
        }


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) * math.sin(dlat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon / 2) * math.sin(dlon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_histogram_similarity(img_path1, img_path2):
    try:
        # Load images
        img1 = cv2.imread(img_path1)
        img2 = cv2.imread(img_path2)
        if img1 is None or img2 is None: return 0
        
        # Convert to HSV
        hsv1 = cv2.cvtColor(img1, cv2.COLOR_BGR2HSV)
        hsv2 = cv2.cvtColor(img2, cv2.COLOR_BGR2HSV)
        
        # Calculate Histogram
        hist1 = cv2.calcHist([hsv1], [0, 1], None, [180, 256], [0, 180, 0, 256])
        hist2 = cv2.calcHist([hsv2], [0, 1], None, [180, 256], [0, 180, 0, 256])
        
        # Normalize
        cv2.normalize(hist1, hist1, 0, 1, cv2.NORM_MINMAX)
        cv2.normalize(hist2, hist2, 0, 1, cv2.NORM_MINMAX)
        
        # Compare (Correlation)
        similarity = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
        return max(0, similarity) # 0 to 1
    except Exception as e:
        # Silently fail for now or log
        # print(f"Hist Error: {e}")
        return 0

def calculate_match_score(lost_report, found_report):
    """
    Enhanced Matching Algorithm (100% Scale):
    1. Hard Filter: Species (Pre-filtered)
    2. Location (40%): Distance Decay
    3. Breed (25%): Fuzzy Match
    4. Size (15%): Exact Match (15), Mismatch (0)
    5. Color (10%): Keyword Match
    6. Features (10%): 
       - Semantic Keywords (5%)
       - Visual Similarity (5%) - Histogram Proxy
    """
    score = 0
    details: dict[str, any] = {}

    # 1. Location Score (40%)
    try:
        if lost_report.lat and lost_report.lng and found_report.lat and found_report.lng:
            dist = haversine_distance(float(lost_report.lat), float(lost_report.lng), 
                                      float(found_report.lat), float(found_report.lng))
            details['distance'] = f"{dist:.2f}km"
            
            # Distance Decay
            if dist < 1:
                score += 40
            elif dist < 5:
                score += 30
            elif dist < 10:
                score += 20
            elif dist < 20:
                score += 10
            else:
                 details['location_score'] = 0
    except Exception as e:
        print(f"Error calculating distance: {e}")

    # 2. Breed Score (25%)
    lost_breed = (lost_report.breed or "").lower()
    found_breed = (found_report.breed or "").lower()
    
    if lost_breed and found_breed:
        if lost_breed == found_breed:
            score += 25
            details['breed_match'] = "Exact"
        elif lost_breed in found_breed or found_breed in lost_breed:
            score += 15
            details['breed_match'] = "Partial"
        else:
            # Fuzzy match
            ratio = SequenceMatcher(None, lost_breed, found_breed).ratio()
            if ratio > 0.6:
                score += int(25 * ratio)
                details['breed_match'] = f"Fuzzy ({int(ratio*100)}%)"

    # 3. Size Score (15%) - Mismatch Penalty (Score 0 if mismatch)
    lost_size = (lost_report.size or "").lower()
    found_size = (found_report.size or "").lower()
    
    if lost_size and found_size:
        if lost_size == found_size:
            score += 15
            details['size_match'] = "Exact"
        else:
             # Logic: Mismatch gets 0
             pass 

    # 4. Color Score (10%)
    lost_color = (lost_report.color or "").lower()
    found_color = (found_report.color or "").lower()
    
    if lost_color and found_color:
        if lost_color in found_color or found_color in lost_color:
             score += 10
             details['color_match'] = True
        else:
             common_chars = set(lost_color) & set(found_color)
             if len(common_chars) > 0:
                 score += 5
                 details['color_match'] = "Partial"

    # 5. Features (10% split)
    # A. Visual Similarity (5%)
    visual_score = 0
    # Use image_path (Thumbnails) for now
    if lost_report.image_path and found_report.image_path:
        if os.path.exists(lost_report.image_path) and os.path.exists(found_report.image_path):
             sim = calculate_histogram_similarity(lost_report.image_path, found_report.image_path)
             if sim > 0:
                visual_score = int(sim * 5) # Map 0-1 to 0-5
                details['visual_similarity'] = f"{sim:.2f}"
    score += visual_score

    # B. Semantic Keywords (5%)
    lost_text = f"{lost_report.features or ''} {lost_report.description or ''} {lost_report.collar or ''}".lower()
    found_text = f"{found_report.features or ''} {found_report.description or ''} {found_report.collar or ''}".lower()
    
    if lost_text and found_text:
        keywords = ["項圈", "受傷", "晶片", "剪耳", "皮膚病", "麒麟尾", "沒有尾巴"]
        matches = [k for k in keywords if k in lost_text and k in found_text]
        
        if matches:
            score += 5
            details['semantic_keywords'] = matches
        else:
            # Fallback: General text similarity
            ratio = SequenceMatcher(None, lost_text, found_text).ratio()
            if ratio > 0.1: # Threshold
                score += int(5 * ratio)

    # 6. Bonus: ID Match (Override to 100 if microchip matches)
    if lost_report.microchip_id and found_report.microchip_id:
        if lost_report.microchip_id == found_report.microchip_id:
            score = 100
            details['microchip_match'] = "EXACT MATCH"

    return int(min(100, score)), details
