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

    const formatDate = (timestamp) => {
        if (!timestamp?.toDate) return '';
        const d = timestamp.toDate();
        return d.toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatTime = (timestamp) => {
        if (!timestamp?.toDate) return '';
        return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getDirectionLabel = (dir) => {
        if (dir === 'home-to-campus') return '🏠 → 🏫';
        if (dir === 'campus-to-home') return '🏫 → 🏠';
        return '🚌';
    };

    const renderItem = ({ item }) => {
        const isFare = item.type === 'fare-deduction';
        const isTopup = item.type === 'top-up';

        return (
            <View style={styles.logItem}>
                {/* Left: Icon */}
                <View style={[styles.iconContainer, isTopup ? styles.topupIcon : styles.fareIcon]}>
                    <Ionicons
                        name={isTopup ? 'arrow-down' : 'bus'}
                        size={20}
                        color="#fff"
                    />
                </View>

                {/* Center: Details */}
                <View style={styles.logInfo}>
                    <View style={styles.titleRow}>
                        <Text style={styles.logType}>
                            {isTopup ? 'Wallet Top-up' : 'Shuttle Fare'}
                        </Text>
                        {isFare && item.direction && (
                            <Text style={styles.directionBadge}>
                                {getDirectionLabel(item.direction)}
                            </Text>
                        )}
                    </View>

                    <Text style={styles.logDate}>
                        {formatDate(item.timestamp)} • {formatTime(item.timestamp)}
                    </Text>

                    {/* Trip details for fare deductions */}
                    {isFare && (
                        <View style={styles.tripDetails}>
                            {item.distanceKm && (
                                <View style={styles.detailChip}>
                                    <Ionicons name="navigate" size={12} color="#6366f1" />
                                    <Text style={styles.detailText}>{item.distanceKm} km</Text>
                                </View>
                            )}
                            {item.pricePerKm && (
                                <View style={styles.detailChip}>
                                    <Ionicons name="pricetag" size={12} color="#94a3b8" />
                                    <Text style={styles.detailText}>Rs.{item.pricePerKm}/km</Text>
                                </View>
                            )}
                            {item.route && (
                                <View style={styles.detailChip}>
                                    <Ionicons name="swap-horizontal" size={12} color="#94a3b8" />
                                    <Text style={styles.detailText}>{item.route}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* Right: Amount */}
                <Text style={[styles.amount, isTopup ? styles.positive : styles.negative]}>
                    {isTopup ? '+' : '-'} Rs. {Math.abs(item.amount)}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>Trip History</Text>
                <Text style={styles.headerCount}>{logs.length} transactions</Text>
            </View>

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
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
    headerCount: { color: '#94a3b8', fontSize: 13 },
    listContent: { padding: 20, paddingTop: 8 },
    logItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#1e293b',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    iconContainer: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    topupIcon: { backgroundColor: '#22c55e' },
    fareIcon: { backgroundColor: '#6366f1' },
    logInfo: { flex: 1, marginLeft: 14 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logType: { color: '#fff', fontSize: 15, fontWeight: '700' },
    directionBadge: {
        fontSize: 12,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        overflow: 'hidden',
    },
    logDate: { color: '#94a3b8', fontSize: 12, marginTop: 3 },
    tripDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    detailChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    detailText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
    amount: { fontSize: 16, fontWeight: '800', marginTop: 2 },
    positive: { color: '#22c55e' },
    negative: { color: '#ef4444' },
    emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 16 },
});
