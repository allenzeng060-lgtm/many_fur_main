export const REGION_MAPPING: Record<string, string[]> = {
    "北部": ["基隆市", "台北市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "宜蘭縣"],
    "中部": ["苗栗縣", "台中市", "臺中市", "彰化縣", "南投縣", "雲林縣"],
    "南部": ["嘉義市", "嘉義縣", "台南市", "臺南市", "高雄市", "屏東縣"],
    "東部": ["花蓮縣", "台東縣", "臺東縣"],
    "離島": ["澎湖縣", "金門縣", "連江縣"]
};

export const getRegionFromCity = (city: string): string => {
    for (const [region, cities] of Object.entries(REGION_MAPPING)) {
        if (cities.some(c => city.includes(c) || c.includes(city))) {
            return region;
        }
    }
    return "北部"; // Default or Unknown
};
