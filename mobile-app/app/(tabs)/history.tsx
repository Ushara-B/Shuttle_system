import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { db, auth } from '../../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const studentUid = auth.currentUser?.uid;
        if (!studentUid) return;

        const q = query(
            collection(db, "payments"),
            where("studentUid", "==", studentUid),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLogs(history);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const renderItem = ({ item }) => (
        <View style={styles.logItem}>
            <View style={[styles.iconContainer, item.type === 'top-up' ? styles.topupIcon : styles.fareIcon]}>
                <Ionicons
                    name={item.type === 'top-up' ? 'arrow-down' : 'bus'}
                    size={20}
                    color="#fff"
                />
            </View>
            <View style={styles.logInfo}>
                <Text style={styles.logType}>
                    {item.type === 'top-up' ? 'Wallet Top-up' : 'Shuttle Fare'}
                </Text>
                <Text style={styles.logDate}>
                    {item.timestamp?.toDate().toLocaleDateString()} at {item.timestamp?.toDate().toLocaleTimeString([], { hour: '2-刻', minute: '2-digit' })}
                </Text>
            </View>
            <Text style={[styles.amount, item.type === 'top-up' ? styles.positive : styles.negative]}>
                {item.type === 'top-up' ? '+' : '-'} Rs. {Math.abs(item.amount)}
            </Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator style={styles.center} color="#6366f1" />
            ) : logs.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="receipt-outline" size={48} color="#334155" />
                    <Text style={styles.emptyText}>No transactions yet</Text>
                </View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20 },
    logItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        padding: 15,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    iconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    topupIcon: { backgroundColor: '#22c55e' },
    fareIcon: { backgroundColor: '#6366f1' },
    logInfo: { flex: 1, marginLeft: 15 },
    logType: { color: '#fff', fontSize: 15, fontWeight: '600' },
    logDate: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
    amount: { fontSize: 16, fontWeight: 'bold' },
    positive: { color: '#22c55e' },
    negative: { color: '#ef4444' },
    emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 16 }
});
