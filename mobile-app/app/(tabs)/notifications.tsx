import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = {
    bg: '#F5F6FA',
    card: '#FFFFFF',
    cardUnread: '#F3F0FF',
    border: '#E8E9F5',
    borderUnread: '#7C3AED30',
    header: '#FFFFFF',
    primary: '#7C3AED',
    primaryLight: '#7C3AED',
    cyan: '#06B6D4',
    emerald: '#10B981',
    amber: '#F59E0B',
    text: '#1A1A3A',
    dim: '#6B7280',
    error: '#EF4444',
};

type Notif = {
    id: string; icon: any; iconBg: string; iconColor: string;
    title: string; body: string; time: string; unread: boolean;
};

const INITIAL: Notif[] = [
    {
        id: '1', icon: 'wallet', iconBg: '#D1FAE5', iconColor: '#059669',
        title: 'Wallet Topped Up', unread: true, time: '2 hours ago',
        body: 'Rs. 500 has been added to your shuttle wallet by the administrator.',
    },
    {
        id: '2', icon: 'bus', iconBg: '#EDE9FE', iconColor: '#7C3AED',
        title: 'Trip Completed', unread: true, time: 'Yesterday, 8:12 AM',
        body: 'Your Home → Campus trip was completed. Rs. 150 deducted from your wallet.',
    },
    {
        id: '3', icon: 'megaphone', iconBg: '#FEF3C7', iconColor: '#D97706',
        title: 'Semester Discount 🎉', unread: false, time: '2 days ago',
        body: 'New semester promo! Get 20% off all trips this week. Discount applied automatically.',
    },
    {
        id: '4', icon: 'shield-checkmark', iconBg: '#D1FAE5', iconColor: '#059669',
        title: 'Account Verified', unread: false, time: '3 days ago',
        body: 'Your student account has been verified by the system administrator.',
    },
    {
        id: '5', icon: 'warning', iconBg: '#FEE2E2', iconColor: '#DC2626',
        title: 'Low Balance Alert', unread: false, time: '4 days ago',
        body: 'Your wallet balance is below Rs. 100. Please top up to ensure uninterrupted trips.',
    },
    {
        id: '6', icon: 'bus', iconBg: '#CFFAFE', iconColor: '#0891B2',
        title: 'New Route Available', unread: false, time: '1 week ago',
        body: 'Route C (North Campus → Main Gate) is now live on the shuttle system.',
    },
    {
        id: '7', icon: 'star', iconBg: '#EDE9FE', iconColor: '#7C3AED',
        title: 'Welcome to Smart Shuttle', unread: false, time: '2 weeks ago',
        body: 'Your account is ready! Show your QR code at the shuttle entrance to pay seamlessly.',
    },
];

export default function NotificationsScreen() {
    const [notifs, setNotifs] = useState<Notif[]>(INITIAL);

    const markAllRead = () => setNotifs(prev => prev.map(n => ({ ...n, unread: false })));
    const unreadCount = notifs.filter(n => n.unread).length;

    const renderItem = ({ item }: { item: Notif }) => (
        <View style={[styles.card, item.unread && styles.cardUnread]}>
            <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={20} color={item.iconColor} />
            </View>
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    {item.unread && <View style={styles.dot} />}
                </View>
                <Text style={styles.bodyText}>{item.body}</Text>
                <Text style={styles.time}>{item.time}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.actionBar}>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllRead} style={styles.markBtn}>
                        <Text style={styles.markBtnText}>Mark all read ({unreadCount})</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={notifs}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="notifications-off-outline" size={64} color={C.border} />
                        <Text style={styles.emptyText}>No notifications</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    actionBar: {
        flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
    },
    markBtn: {
        backgroundColor: '#7C3AED', paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20,
    },
    markBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    list: { padding: 16 },
    card: {
        flexDirection: 'row', backgroundColor: '#F8F8FB', borderRadius: 18,
        borderWidth: 1, borderColor: '#EBEBF5', padding: 16, marginBottom: 12, gap: 14,
    },
    cardUnread: { backgroundColor: '#F0EDFF', borderColor: '#C4B5FD' },
    iconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    body: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    title: { fontSize: 15, fontWeight: '800', color: C.text, flex: 1 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary },
    bodyText: { fontSize: 13, color: C.dim, lineHeight: 20, fontWeight: '500' },
    time: { fontSize: 11, color: '#9CA3AF', marginTop: 6, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 16 },
    emptyText: { color: C.dim, fontSize: 16, fontWeight: '600' },
});
