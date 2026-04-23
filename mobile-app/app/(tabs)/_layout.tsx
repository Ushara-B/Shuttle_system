import { Redirect, Tabs, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ActivityIndicator, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

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
    const [hasNotifications, setHasNotifications] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (user) {
                setAuthed(true);
            } else {
                setAuthed(false);
            }
            setChecked(true);
        });
        return () => unsub();
    }, [router]);

    useEffect(() => {
        if (!authed) return;
        const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(1));
        const unsub = onSnapshot(q, (snap) => setHasNotifications(!snap.empty));
        return () => unsub();
    }, [authed]);

    if (!checked) {
        return (
            <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} size="large" />
            </View>
        );
    }

    // On web, logout flow performs a single hard refresh from profile screen.
    // Returning null here avoids an extra redirect animation/flicker.
    if (!authed) {
        if (Platform.OS === 'web') return null;
        return <Redirect href="/" />;
    }

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
                            {hasNotifications && (
                                <View style={{
                                    position: 'absolute', top: -2, right: -6,
                                    width: 10, height: 10, borderRadius: 5,
                                    backgroundColor: '#EF4444',
                                    borderWidth: 1.5, borderColor: '#FFFFFF',
                                }} />
                            )}
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
