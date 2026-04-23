import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity, ActivityIndicator } from 'react-native';
import { db, auth } from '../../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, getDistanceToCampus, CAMPUS_COORDS } from '../../utils/location';

export default function WalletScreen() {
    const [balance, setBalance] = useState(0);
    const [studentId, setStudentId] = useState('');
    const [loading, setLoading] = useState(true);
    const [distance, setDistance] = useState<number | null>(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const fadeAnim = new Animated.Value(0);

    useEffect(() => {
        const studentUid = auth.currentUser?.uid;
        if (!studentUid) return;

        const unsubscribe = onSnapshot(doc(db, "wallets", studentUid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBalance(data.balance);
                setStudentId(data.studentId || 'N/A');
                setLoading(false);
                Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
            }
        });

        return () => unsubscribe();
    }, []);

    // Get GPS location
    useEffect(() => {
        (async () => {
            const loc = await getCurrentLocation();
            if (loc) {
                const dist = getDistanceToCampus(loc.latitude, loc.longitude);
                setDistance(dist);
            }
            setLocationLoading(false);
        })();
    }, []);

    const estimatedFare = distance ? Math.round(distance * 10) : null; // Rs. 10/km default

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Animated.View style={[styles.balanceCard, { opacity: fadeAnim }]}>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>Rs. {balance.toLocaleString()}</Text>
                <View style={styles.cardFooter}>
                    <Text style={styles.studentIdLabel}>Student ID: {studentId}</Text>
                    <Ionicons name="card" size={24} color="rgba(255,255,255,0.6)" />
                </View>
            </Animated.View>

            {/* Distance Info Card */}
            <View style={styles.distanceCard}>
                <View style={styles.distanceRow}>
                    <Ionicons name="location" size={20} color="#6366f1" />
                    <Text style={styles.distanceLabel}>Distance to Campus</Text>
                </View>
                {locationLoading ? (
                    <ActivityIndicator color="#6366f1" style={{ marginTop: 10 }} />
                ) : distance ? (
                    <View>
                        <Text style={styles.distanceValue}>{distance} km</Text>
                        <Text style={styles.estimatedFare}>
                            Estimated fare: Rs. {estimatedFare} (@ Rs. 10/km)
                        </Text>
                    </View>
                ) : (
                    <Text style={styles.distanceNA}>Allow location access to see distance</Text>
                )}
            </View>

            <View style={styles.qrSection}>
                <Text style={styles.qrTitle}>Your Payment QR</Text>
                <Text style={styles.qrSubtitle}>Scan this at the shuttle entrance</Text>

                <View style={styles.qrContainer}>
                    <QRCode
                        value={auth.currentUser?.uid || 'invalid'}
                        size={240}
                        color="#000"
                        backgroundColor="#fff"
                        quietZone={10}
                    />
                </View>

                <View style={styles.securityBadge}>
                    <Ionicons name="shield-checkmark" size={16} color="#22c55e" />
                    <Text style={styles.securityText}>Secured by Smart Shuttle Sync</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.helpButton}>
                <Ionicons name="help-circle" size={20} color="#94a3b8" />
                <Text style={styles.helpText}>Need help with payments?</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { padding: 20, alignItems: 'center' },
    balanceCard: {
        width: '100%',
        backgroundColor: '#6366f1',
        borderRadius: 24,
        padding: 25,
        marginBottom: 20,
        elevation: 10,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '500' },
    balanceAmount: { color: '#fff', fontSize: 36, fontWeight: '800', marginVertical: 10 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    studentIdLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

    // Distance Card
    distanceCard: {
        width: '100%',
        backgroundColor: '#1e293b',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distanceLabel: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
    distanceValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 8 },
    estimatedFare: { color: '#22c55e', fontSize: 14, fontWeight: '600', marginTop: 4 },
    distanceNA: { color: '#94a3b8', fontSize: 13, marginTop: 8, fontStyle: 'italic' },

    qrSection: {
        backgroundColor: '#1e293b',
        width: '100%',
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#334155',
    },
    qrTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
    qrSubtitle: { color: '#94a3b8', fontSize: 14, marginBottom: 25 },
    qrContainer: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 24,
        marginBottom: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    securityBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    securityText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
    helpButton: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 40 },
    helpText: { color: '#94a3b8', fontSize: 14 }
});
