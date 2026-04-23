import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../firebase';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';

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
    id: string;
    title: string;
    note: string;
    createdAt?: any;
    createdByName?: string;
};

const getRelativeTime = (value: any) => {
    // Turn a Firestore Timestamp into a short "relative" label.
    // This keeps the UI readable without needing heavy date libraries.
    if (!value?.toDate) return 'Just now';
    const date = value.toDate();
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
};

export default function NotificationsScreen() {
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Notifications are broadcast by admins and stored in Firestore.
        // We listen in real time so students see updates instantly.
        const studentUid = auth.currentUser?.uid;
        if (!studentUid) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(100));
        const unsub = onSnapshot(q, (snapshot) => {
            setNotifs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Notif)));
            setLoading(false);
        }, () => setLoading(false));

        return () => unsub();
    }, []);

    const renderItem = ({ item }: { item: Notif }) => (
        <View style={styles.card}>
            <View style={styles.iconCircle}>
                <Ionicons name="megaphone" size={20} color="#7C3AED" />
            </View>
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={styles.bodyText}>{item.note}</Text>
                <Text style={styles.time}>{getRelativeTime(item.createdAt)}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator style={styles.loader} color={C.primary} />
            ) : (
                <FlatList
                    data={notifs}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="notifications-off-outline" size={64} color={C.border} />
                            <Text style={styles.emptyText}>No notifications yet</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    loader: { marginTop: 40 },
    list: { padding: 16 },
    card: {
        flexDirection: 'row', backgroundColor: '#F8F8FB', borderRadius: 18,
        borderWidth: 1, borderColor: '#EBEBF5', padding: 16, marginBottom: 12, gap: 14,
    },
    iconCircle: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EDE9FE' },
    body: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    title: { fontSize: 15, fontWeight: '800', color: C.text, flex: 1 },
    bodyText: { fontSize: 13, color: C.dim, lineHeight: 20, fontWeight: '500' },
    time: { fontSize: 11, color: '#9CA3AF', marginTop: 6, fontWeight: '600' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 16 },
    emptyText: { color: C.dim, fontSize: 16, fontWeight: '600' },
});
