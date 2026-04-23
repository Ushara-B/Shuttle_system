import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
    bg: '#F5F6FA',
    card: '#FFFFFF',
    border: '#E8E9F5',
    primary: '#7C3AED',
    primaryLight: '#A78BFA',
    cyan: '#06B6D4',
    emerald: '#10B981',
    amber: '#F59E0B',
    text: '#1A1A3A',
    dim: '#6B7280',
    error: '#EF4444',
};

type SettingsItem = { icon: any; color: string; bg: string; label: string; sub: string; onPress?: () => void };

const handleNotImplemented = () => Alert.alert('Coming Soon', 'This feature will be available in a future update.');

const SECTIONS: { title: string; items: SettingsItem[] }[] = [
    {
        title: 'Help & Support',
        items: [
            {
                icon: 'help-buoy', color: C.amber, bg: '#1A0C00',
                label: 'Help & Support', sub: 'FAQs, tutorials, and how-to guides',
                onPress: handleNotImplemented,
            },
            {
                icon: 'chatbubble-ellipses', color: C.cyan, bg: '#001A2E',
                label: 'Contact Support', sub: 'Chat with our support team',
                onPress: () => Linking.openURL('mailto:support@smartshuttle.lk'),
            },
            {
                icon: 'bug', color: C.error, bg: '#1A0A0A',
                label: 'Report a Problem', sub: 'Let us know if something is wrong',
                onPress: handleNotImplemented,
            },
        ],
    },
    {
        title: 'Security & Privacy',
        items: [
            {
                icon: 'lock-closed', color: C.emerald, bg: '#0D2E1F',
                label: 'Security & Privacy', sub: 'Password, sessions, and access control',
                onPress: handleNotImplemented,
            },
            {
                icon: 'eye-off', color: C.primaryLight, bg: '#1A1040',
                label: 'Data & Privacy Policy', sub: 'How we collect and use your data',
                onPress: handleNotImplemented,
            },
            {
                icon: 'key', color: C.amber, bg: '#1A0C00',
                label: 'Change Password', sub: 'Update your login credentials',
                onPress: handleNotImplemented,
            },
        ],
    },
    {
        title: 'About the App',
        items: [
            {
                icon: 'information-circle', color: C.dim, bg: '#13132B',
                label: 'About Smart Shuttle', sub: 'Version 1.2.0 • Campus Mobility Platform',
                onPress: handleNotImplemented,
            },
            {
                icon: 'document-text', color: C.cyan, bg: '#001A2E',
                label: 'Terms of Service', sub: 'Read our full terms and conditions',
                onPress: handleNotImplemented,
            },
            {
                icon: 'star', color: C.amber, bg: '#1A0C00',
                label: 'Rate the App', sub: 'Share your experience on the store',
                onPress: handleNotImplemented,
            },
        ],
    },
];

export default function SettingsScreen() {
    // This is a placeholder settings hub for student users.
    // Most actions are intentionally "Coming Soon" so we can ship the core wallet + scan flow first.
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {SECTIONS.map((section) => (
                <View key={section.title} style={styles.group}>
                    <Text style={styles.groupTitle}>{section.title.toUpperCase()}</Text>
                    <View style={styles.card}>
                        {section.items.map((item, idx) => (
                            <TouchableOpacity
                                key={item.label}
                                style={[styles.row, idx < section.items.length - 1 && styles.rowDivider]}
                                onPress={item.onPress}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                                    <Ionicons name={item.icon} size={22} color={item.color} />
                                </View>
                                <View style={styles.rowText}>
                                    <Text style={styles.rowLabel}>{item.label}</Text>
                                    <Text style={styles.rowSub}>{item.sub}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={C.border} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 20, paddingBottom: 40 },
    group: { marginBottom: 24 },
    groupTitle: {
        fontSize: 11, fontWeight: '800', color: C.dim,
        letterSpacing: 1.5, marginBottom: 10, marginLeft: 4,
    },
    card: {
        backgroundColor: C.card, borderRadius: 20,
        borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
    iconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: '700', color: C.text },
    rowSub: { fontSize: 12, color: C.dim, marginTop: 2, fontWeight: '500' },
});
