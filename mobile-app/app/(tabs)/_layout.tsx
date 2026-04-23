import { Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ActivityIndicator, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';

const C = {
    bg: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBorder: '#F0F0F8',
    header: '#F0EDFF',
    headerBorder: '#DDD6FE',
    primary: '#7C3AED',
    inactive: '#9CA3AF',
    text: '#3B0764',
};

export default function TabLayout() {
    const [checked, setChecked] = useState(false);
    const [authed, setAuthed] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) setAuthed(true);
            else router.replace('/');
            setChecked(true);
        });
        return () => unsub();
    }, []);

    if (!checked) {
        return (
            <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} size="large" />
            </View>
        );
    }

    if (!authed) return null;

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: C.primary,
                tabBarInactiveTintColor: C.inactive,
                tabBarStyle: {
                    backgroundColor: C.tabBar,
                    borderTopColor: C.tabBorder,
                    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
                    height: Platform.OS === 'ios' ? 80 : 64,
                },
                headerStyle: {
                    backgroundColor: C.header,
                    elevation: 0,
                    shadowOpacity: 0,
                    borderBottomWidth: 2,
                    borderBottomColor: C.headerBorder,
                },
                headerTintColor: C.text,
                headerTitleStyle: { fontWeight: '900', fontSize: 18 },
                headerRight: () => (
                    <TouchableOpacity
                        onPress={() => router.push('/settings')}
                        style={{ marginRight: 18, padding: 4 }}
                    >
                        <Ionicons name="settings-outline" size={24} color={C.text} />
                    </TouchableOpacity>
                ),
            }}>

            <Tabs.Screen
                name="index"
                options={{
                    title: 'Wallet',
                    tabBarIcon: ({ color }) => <Ionicons name="wallet" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="history"
                options={{
                    title: 'History',
                    tabBarIcon: ({ color }) => <Ionicons name="time" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: 'Notifications',
                    tabBarIcon: ({ color }) => (
                        <View>
                            <Ionicons name="notifications" size={24} color={color} />
                            {/* Unread badge */}
                            <View style={{
                                position: 'absolute', top: -2, right: -6,
                                width: 10, height: 10, borderRadius: 5,
                                backgroundColor: '#EF4444',
                                borderWidth: 1.5, borderColor: '#FFFFFF',
                            }} />
                        </View>
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
