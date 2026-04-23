import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../firebase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation } from '../../utils/location';

const C = {
    bg: '#F5F6FA',
    card: '#FFFFFF',
    border: '#E8E9F5',
    header: '#FFFFFF',
    primary: '#7C3AED',
    primaryLight: '#A78BFA',
    cyan: '#06B6D4',
    emerald: '#10B981',
    amber: '#F59E0B',
    text: '#1A1A3A',
    dim: '#6B7280',
    error: '#EF4444',
    input: '#F8F8FC',
};

type Field = { icon: any; label: string; placeholder: string; key: string; keyboard?: any; maxLen?: number };

const FIELDS: Field[] = [
    { icon: 'person-outline', label: 'Full Name', placeholder: 'e.g. Sanduni Perera', key: 'fullName' },
    { icon: 'home-outline', label: 'Home Address', placeholder: 'e.g. 45 Galle Rd, Colombo', key: 'address' },
    { icon: 'book-outline', label: 'Field of Study', placeholder: 'e.g. Computer Science', key: 'fieldOfStudy' },
    { icon: 'school-outline', label: 'Current Year', placeholder: '1 – 4', key: 'currentYear', keyboard: 'numeric', maxLen: 1 },
];

export default function ProfileScreen() {
    const user = auth.currentUser;
    const router = useRouter();

    const [form, setForm] = useState<Record<string, string>>({
        fullName: '', address: '', fieldOfStudy: '', currentYear: '',
    });
    const [locationText, setLocationText] = useState('Not saved yet');
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [locLoading, setLocLoading] = useState(false);

    useEffect(() => { loadProfile(); }, []);

    const loadProfile = async () => {
        if (!user?.uid) return;
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (snap.exists()) {
                const d = snap.data();
                setForm({
                    fullName: d.displayName || d.fullName || '',
                    address: d.address || '',
                    fieldOfStudy: d.fieldOfStudy || '',
                    currentYear: d.currentYear ? String(d.currentYear) : '',
                });
                if (d.homeLocation?.latitude) {
                    setLocationText(
                        `${d.homeLocation.latitude.toFixed(5)}, ${d.homeLocation.longitude.toFixed(5)}`
                    );
                }
            }
        } catch (e) { console.warn('Load profile error:', e); }
        setLoaded(true);
    };

    const handleGetLocation = async () => {
        setLocLoading(true);
        try {
            const loc = await getCurrentLocation();
            if (!loc) {
                Alert.alert('Permission Required', 'Please allow location access in your device settings.');
                setLocLoading(false);
                return;
            }
            const { latitude, longitude } = loc;
            setLocationText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
            if (user?.uid) {
                await setDoc(doc(db, 'users', user.uid), {
                    homeLocation: { latitude, longitude, updatedAt: new Date().toISOString() },
                }, { merge: true });
                Alert.alert('✅ Location Saved', 'Your home coordinates are stored for accurate fare calculation.');
            }
        } catch (e) {
            Alert.alert('Error', 'Could not fetch location. Please try again.');
        }
        setLocLoading(false);
    };

    const handleSave = async () => {
        if (!user?.uid) return;
        setSaving(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                displayName: form.fullName,
                fullName: form.fullName,
                address: form.address,
                fieldOfStudy: form.fieldOfStudy,
                currentYear: form.currentYear ? Number(form.currentYear) : null,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            Alert.alert('Profile Saved', 'Your details have been updated successfully.');
        } catch (e) { Alert.alert('Error', 'Could not save profile. Please try again.'); }
        setSaving(false);
    };

    const handleLogout = async () => {
        try { await signOut(auth); router.replace('/'); }
        catch (e) { console.error('Sign out error:', e); }
    };

    const initials = (form.fullName || user?.email || 'S').charAt(0).toUpperCase();

    if (!loaded) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color={C.primary} size="large" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Avatar */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                        <View style={styles.avatarBadge}>
                            <Ionicons name="pencil" size={12} color="#fff" />
                        </View>
                    </View>
                    <Text style={styles.nameText}>{form.fullName || 'Student'}</Text>
                    <Text style={styles.emailText}>{user?.email}</Text>
                </View>

                {/* Form Fields */}
                <View style={styles.card}>
                    <Text style={styles.sectionLabel}>Personal Information</Text>
                    {FIELDS.map((field) => (
                        <View key={field.key} style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{field.label}</Text>
                            <View style={styles.inputRow}>
                                <Ionicons name={field.icon} size={18} color={C.dim} style={{ marginRight: 10 }} />
                                <TextInput
                                    style={styles.input}
                                    value={form[field.key]}
                                    onChangeText={(v) => setForm(prev => ({ ...prev, [field.key]: v }))}
                                    placeholder={field.placeholder}
                                    placeholderTextColor={C.dim}
                                    keyboardType={field.keyboard || 'default'}
                                    maxLength={field.maxLen}
                                />
                            </View>
                        </View>
                    ))}
                </View>

                {/* Location Card */}
                <View style={styles.card}>
                    <Text style={styles.sectionLabel}>Home Location</Text>
                    <View style={styles.locationRow}>
                        <View style={styles.locationIconCircle}>
                            <Ionicons name="location" size={22} color={C.cyan} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.locationLabel}>Saved Coordinates</Text>
                            <Text style={styles.locationValue}>{locationText}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.locBtn}
                            onPress={handleGetLocation}
                            disabled={locLoading}
                        >
                            {locLoading
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <><Ionicons name="locate" size={16} color="#fff" /><Text style={styles.locBtnText}>Update</Text></>
                            }
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.locationHint}>
                        📍 Used to calculate accurate shuttle fares. Tap "Update" anytime you move residence.
                    </Text>
                </View>

                {/* Save */}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving
                        ? <ActivityIndicator color="#fff" />
                        : <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.saveBtnText}>Save Profile</Text></>
                    }
                </TouchableOpacity>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color={C.error} />
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>

                <Text style={styles.version}>Smart Shuttle v1.2.0 • Campus Edition</Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bg },
    content: { padding: 20, paddingBottom: 50 },

    avatarSection: { alignItems: 'center', paddingVertical: 28 },
    avatar: {
        width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary,
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
        shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
    },
    avatarText: { fontSize: 36, fontWeight: '900', color: '#fff' },
    avatarBadge: {
        position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13,
        backgroundColor: C.emerald, borderWidth: 2, borderColor: C.bg, justifyContent: 'center', alignItems: 'center',
    },
    nameText: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
    emailText: { fontSize: 14, color: C.dim, marginTop: 4, fontWeight: '500' },

    card: {
        backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border,
        padding: 20, marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 11, fontWeight: '800', color: C.dim, textTransform: 'uppercase',
        letterSpacing: 1.5, marginBottom: 16,
    },

    inputGroup: { marginBottom: 14 },
    inputLabel: { fontSize: 12, fontWeight: '700', color: C.dim, marginBottom: 8 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.input, borderRadius: 14, borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 14,
    },
    input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 14 },

    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    locationIconCircle: {
        width: 46, height: 46, borderRadius: 14, backgroundColor: '#001A2E',
        justifyContent: 'center', alignItems: 'center',
    },
    locationLabel: { fontSize: 11, color: C.dim, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    locationValue: { fontSize: 13, color: C.text, fontWeight: '700', marginTop: 3 },
    locBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: C.cyan, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    },
    locBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    locationHint: { fontSize: 12, color: C.dim, lineHeight: 18 },

    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: C.primary, padding: 18, borderRadius: 18, gap: 10, marginBottom: 12,
        shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(248,113,113,0.08)', padding: 16, borderRadius: 18,
        gap: 10, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', marginBottom: 24,
    },
    logoutText: { color: C.error, fontSize: 16, fontWeight: '700' },

    version: { textAlign: 'center', color: C.dim, fontSize: 12, fontWeight: '500' },
});
