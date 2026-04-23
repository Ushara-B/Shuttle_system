import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity,
    ActivityIndicator, Modal, Pressable
} from 'react-native';
import { db, auth } from '../../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, getDistanceToCampus } from '../../utils/location';

export default function WalletScreen() {
    const [balance, setBalance] = useState(0);
    const [studentId, setStudentId] = useState('');
    const [loading, setLoading] = useState(true);
    const [distance, setDistance] = useState<number | null>(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [qrVisible, setQrVisible] = useState(false);
    const amountFade = useState(() => new Animated.Value(0))[0];

    useEffect(() => {
        const studentUid = auth.currentUser?.uid;
        if (!studentUid) return;

        // Wallet balance is the primary real-time value for students.
        const unsubscribe = onSnapshot(doc(db, "wallets", studentUid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBalance(data.balance);
                setStudentId(data.studentId || 'N/A');
                setLoading(false);
                Animated.timing(amountFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
            }
        });

        return () => unsubscribe();
    }, []);

    // Capture home location to improve backend fare calculation.
    // If driver GPS is missing, backend can compute distance using this saved location.
    useEffect(() => {
        (async () => {
            const loc = await getCurrentLocation();
            if (loc) {
                const dist = getDistanceToCampus(loc.latitude, loc.longitude);
                setDistance(dist);

                const studentUid = auth.currentUser?.uid;
                if (studentUid) {
                    try {
                        await setDoc(doc(db, 'users', studentUid), {
                            homeLocation: {
                                latitude: loc.latitude,
                                longitude: loc.longitude,
                                updatedAt: new Date().toISOString(),
                            }
                        }, { merge: true });
                    } catch (e) {
                        console.warn('Could not save home location:', e);
                    }
                }
            }
            setLocationLoading(false);
        })();
    }, []);

    const estimatedFare = distance ? Math.round(distance * 10) : null;

    return (
        <>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Balance Card — always visible, amount fades in when loaded */}
                <View style={styles.balanceCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.balanceLabel}>Available Tokens</Text>
                        <Ionicons name="wifi" size={20} color="rgba(255,255,255,0.7)" />
                    </View>
                    {loading ? (
                        <ActivityIndicator color="rgba(255,255,255,0.7)" size="large" style={{ marginVertical: 22 }} />
                    ) : (
                        <Animated.Text style={[styles.balanceAmount, { opacity: amountFade }]}>
                            Rs. {balance.toLocaleString()}
                        </Animated.Text>
                    )}
                    <View style={styles.cardFooter}>
                        <View>
                            <Text style={styles.cardLabel}>STUDENT ID</Text>
                            <Text style={styles.cardValue}>{studentId || '—'}</Text>
                        </View>
                        <Ionicons name="card" size={32} color="rgba(255,255,255,0.5)" />
                    </View>
                </View>

                {/* Distance Card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <View style={[styles.iconCircle, { backgroundColor: '#F0EDFF' }]}>
                            <Ionicons name="location" size={20} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoLabel}>Nearby Shuttle Stop</Text>
                            {locationLoading ? (
                                <ActivityIndicator color="#7C3AED" size="small" style={{ marginTop: 4, alignSelf: 'flex-start' }} />
                            ) : distance ? (
                                <>
                                    <Text style={styles.infoValue}>{distance} km to Campus</Text>
                                    <Text style={styles.fareText}>Est. fare: Rs. {estimatedFare}</Text>
                                </>
                            ) : (
                                <Text style={styles.infoNA}>Allow location to see distance</Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* Payment Pass Button — same style as info card above */}
                <TouchableOpacity style={styles.passButton} onPress={() => setQrVisible(true)} activeOpacity={0.85}>
                    <View style={styles.infoRow}>
                        <View style={[styles.iconCircle, { backgroundColor: '#EDE9FE' }]}>
                            <Ionicons name="qr-code" size={20} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoLabel}>Payment Pass</Text>
                            <Text style={styles.infoValue}>Tap to show QR code</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#C4B5FD" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.helpButton}>
                    <Ionicons name="help-circle" size={20} color="#C4B5FD" />
                    <Text style={styles.helpText}>How to pay? View Guide</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* QR Modal */}
            <Modal visible={qrVisible} transparent animationType="slide" onRequestClose={() => setQrVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setQrVisible(false)}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        {/* Drag handle */}
                        <View style={styles.dragHandle} />

                        <Text style={styles.modalTitle}>Payment Pass</Text>
                        <Text style={styles.modalSubtitle}>Hold near the shuttle scanner to pay</Text>

                        <View style={styles.qrWrapper}>
                            <QRCode
                                value={auth.currentUser?.uid || 'invalid'}
                                size={230}
                                color="#1A1A3A"
                                backgroundColor="#fff"
                                quietZone={12}
                            />
                        </View>

                        <Text style={styles.studentIdLabel}>Student ID: {studentId}</Text>

                        <View style={styles.securityBadge}>
                            <Ionicons name="shield-checkmark" size={15} color="#059669" />
                            <Text style={styles.securityText}>Encrypted • Secured by Sync</Text>
                        </View>

                        <TouchableOpacity style={styles.closeBtn} onPress={() => setQrVisible(false)}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F6FA' },
    content: { padding: 20, alignItems: 'center', paddingBottom: 40 },

    // Balance card
    balanceCard: {
        width: '100%', backgroundColor: '#7C3AED', borderRadius: 28,
        padding: 24, marginBottom: 16,
        elevation: 12, shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 20,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
    balanceAmount: { color: '#fff', fontSize: 44, fontWeight: '900', marginVertical: 10 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
    cardLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', marginBottom: 2 },
    cardValue: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },

    // Shared info card
    infoCard: {
        width: '100%', backgroundColor: '#FFFFFF', borderRadius: 22,
        padding: 18, marginBottom: 14,
        borderWidth: 1, borderColor: '#F0EDFF',
        shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    iconCircle: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    infoLabel: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
    infoValue: { color: '#1A1A3A', fontSize: 18, fontWeight: '800', marginTop: 2 },
    fareText: { color: '#10B981', fontSize: 13, fontWeight: '700', marginTop: 2 },
    infoNA: { color: '#9CA3AF', fontSize: 13, marginTop: 2, fontWeight: '500' },

    // Payment pass button — same look as infoCard but pressable
    passButton: {
        width: '100%', backgroundColor: '#FFFFFF', borderRadius: 22,
        padding: 18, marginBottom: 14,
        borderWidth: 1.5, borderColor: '#DDD6FE',
        shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3,
    },

    helpButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
    helpText: { color: '#A78BFA', fontSize: 14, fontWeight: '600' },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(26,26,58,0.55)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF', borderTopLeftRadius: 36, borderTopRightRadius: 36,
        padding: 28, paddingBottom: 40, alignItems: 'center',
    },
    dragHandle: {
        width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0D9FF', marginBottom: 24,
    },
    modalTitle: { fontSize: 26, fontWeight: '900', color: '#1A1A3A', marginBottom: 6 },
    modalSubtitle: { fontSize: 14, color: '#6B7280', fontWeight: '500', marginBottom: 28, textAlign: 'center' },
    qrWrapper: {
        padding: 20, backgroundColor: '#fff', borderRadius: 24,
        marginBottom: 20,
        borderWidth: 1, borderColor: '#F0EDFF',
        shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8,
    },
    studentIdLabel: { fontSize: 14, color: '#6B7280', fontWeight: '700', marginBottom: 16 },
    securityBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginBottom: 24,
    },
    securityText: { color: '#059669', fontSize: 12, fontWeight: '700' },
    closeBtn: {
        width: '100%', backgroundColor: '#F0EDFF', padding: 16, borderRadius: 18, alignItems: 'center',
        borderWidth: 1, borderColor: '#DDD6FE',
    },
    closeBtnText: { color: '#7C3AED', fontWeight: '800', fontSize: 16 },
});
