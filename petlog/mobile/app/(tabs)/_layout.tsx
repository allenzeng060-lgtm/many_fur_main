import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "react-native";

export default function TabsLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "首頁",
          tabBarIcon: ({ color }) => <MaterialIcons name="pets" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finding"
        options={{
          title: "協尋",
          tabBarIcon: ({ color }) => <IconSymbol name="magnifyingglass" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mind"
        options={{
          title: "讀心",
          tabBarIcon: ({ color }) => <MaterialIcons name="psychology" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "會員",
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
