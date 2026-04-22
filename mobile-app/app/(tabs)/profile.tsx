import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
    const user = auth.currentUser;
    const router = useRouter();

    const handleLogout = async () => {
        // Alert.alert doesn't work on Expo Web — use window.confirm instead
        const confirmed = Platform.OS === 'web'
            ? window.confirm('Are you sure you want to sign out?')
            : true; // On native, sign out immediately (no confirm needed for simplicity)

        if (confirmed) {
            await signOut(auth);
            router.replace('/');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Ionicons name="person" size={40} color="#fff" />
                </View>
                <Text style={styles.name}>{user?.displayName || 'Student'}</Text>
                <Text style={styles.email}>{user?.email}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Settings</Text>
                <TouchableOpacity style={styles.menuItem}>
                    <Ionicons name="notifications" size={22} color="#6366f1" />
                    <Text style={styles.menuText}>Notifications</Text>
                    <Ionicons name="chevron-forward" size={20} color="#334155" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem}>
                    <Ionicons name="lock-closed" size={22} color="#6366f1" />
                    <Text style={styles.menuText}>Security</Text>
                    <Ionicons name="chevron-forward" size={20} color="#334155" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem}>
                    <Ionicons name="help-buoy" size={22} color="#6366f1" />
                    <Text style={styles.menuText}>Support</Text>
                    <Ionicons name="chevron-forward" size={20} color="#334155" />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                <Text style={styles.logoutText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={styles.version}>Smart Shuttle v1.0.0</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
    header: { alignItems: 'center', marginVertical: 30 },
    avatar: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: '#6366f1',
        justifyContent: 'center', alignItems: 'center', marginBottom: 15
    },
    name: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
    email: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
    section: { marginTop: 20 },
    sectionTitle: {
        color: 'rgba(255,255,255,0.4)', fontSize: 12,
        fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15, letterSpacing: 1
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1e293b', padding: 15, borderRadius: 16, marginBottom: 10
    },
    menuText: { flex: 1, color: '#fff', fontSize: 16, marginLeft: 15 },
    logoutButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 15, borderRadius: 16, marginTop: 'auto', gap: 10
    },
    logoutText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
    version: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 20, marginBottom: 10 }
});
