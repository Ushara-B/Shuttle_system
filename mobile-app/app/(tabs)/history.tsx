import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { db, auth } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const studentUid = auth.currentUser?.uid;
        if (!studentUid) return;

        // Query is intentionally minimal to avoid needing composite indexes.
        // We sort locally by timestamp to keep the app working even if Firestore indexes aren't created yet.
        const q = query(
            collection(db, "payments"),
            where("studentUid", "==", studentUid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            // Real-time transaction history (top-ups + fare deductions).
            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort locally (descending timestamp) to bypass the need for a composite index.
            history.sort((a: any, b: any) => {
                const timeA = a.timestamp?.seconds || 0;
                const timeB = b.timestamp?.seconds || 0;
                return timeB - timeA;
            });

            setLogs(history);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching transactions:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const formatDate = (timestamp: any) => {
        if (!timestamp?.toDate) return '';
        const d = timestamp.toDate();
        return d.toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp?.toDate) return '';
        return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getDirectionLabel = (dir: string) => {
        if (dir === 'home-to-campus') return '🏠 → 🏫';
        if (dir === 'campus-to-home') return '🏫 → 🏠';
        return '🚌';
    };

    const renderItem = ({ item }: { item: any }) => {
        const isFare = item.type === 'fare-deduction';
        const isTopup = item.type === 'top-up';

        return (
            <View style={styles.logItem}>
                {/* Left: Icon */}
                <View style={[styles.iconContainer, isTopup ? styles.topupIcon : styles.fareIcon]}>
                    <Ionicons
                        name={isTopup ? 'arrow-down' : 'bus'}
                        size={20}
                        color={isTopup ? '#059669' : '#7C3AED'}
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
                <View>
                    <Text style={styles.headerTitle}>Transactions</Text>
                    <Text style={styles.headerCount}>{logs.length} items logged</Text>
                </View>
                <Ionicons name="filter" size={24} color="#4F46E5" />
            </View>

            {loading ? (
                <ActivityIndicator style={styles.center} color="#4F46E5" />
            ) : logs.length === 0 ? (
                <View style={[styles.center, { paddingHorizontal: 40 }]}>
                    <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
                    <Text style={[styles.emptyText, { textAlign: 'center' }]}>You currently have no transactional data</Text>
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
    container: { flex: 1, backgroundColor: '#F5F6FA' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F8'
    },
    headerTitle: { color: '#1A1A3A', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerCount: { color: '#6B7280', fontSize: 13, fontWeight: '500' },
    listContent: { padding: 20, paddingTop: 12 },
    logItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E8E9F5',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    topupIcon: { backgroundColor: '#ECFDF5' },
    fareIcon: { backgroundColor: '#F5F3FF' },
    logInfo: { flex: 1, marginLeft: 14 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    logType: { color: '#1A1A3A', fontSize: 16, fontWeight: '700' },
    directionBadge: {
        fontSize: 10,
        fontWeight: '700',
        backgroundColor: '#EEF2FF',
        color: '#4F46E5',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        overflow: 'hidden',
    },
    logDate: { color: '#6B7280', fontSize: 13, marginTop: 2, fontWeight: '500' },
    tripDetails: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    detailChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F3F4F6'
    },
    detailText: { color: '#6B7280', fontSize: 11, fontWeight: '700' },
    amount: { fontSize: 17, fontWeight: '900', marginTop: 2 },
    positive: { color: '#059669' },
    negative: { color: '#1A1A3A' },
    emptyText: { color: '#9CA3AF', marginTop: 16, fontSize: 16, fontWeight: '600' },
});
