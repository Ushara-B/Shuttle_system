import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signOut, updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { db, auth } from '../../firebase';
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
    const [user, setUser] = useState(auth.currentUser);

    const [form, setForm] = useState<Record<string, string>>({
        fullName: '', address: '', fieldOfStudy: '', currentYear: '',
    });
    const [locationText, setLocationText] = useState('Not saved yet');
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [locLoading, setLocLoading] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [accountMsg, setAccountMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [securityMsg, setSecurityMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [securityForm, setSecurityForm] = useState({
        email: user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
        });
        return () => unsub();
    }, []);

    useEffect(() => { loadProfile(); }, [user?.uid]);

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
                setSecurityForm((prev) => ({ ...prev, email: d.email || user?.email || '' }));
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
        if (!form.fullName.trim()) {
            setAccountMsg({ type: 'error', text: 'Full name is required.' });
            return;
        }
        setSaving(true);
        setAccountMsg({ type: 'info', text: 'Saving profile...' });
        try {
            await setDoc(doc(db, 'users', user.uid), {
                displayName: form.fullName.trim(),
                fullName: form.fullName.trim(),
                address: form.address,
                fieldOfStudy: form.fieldOfStudy,
                currentYear: form.currentYear ? Number(form.currentYear) : null,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            await updateProfile(user, { displayName: form.fullName.trim() });
            setAccountMsg({ type: 'success', text: 'Profile updated successfully.' });
        } catch {
            setAccountMsg({ type: 'error', text: 'Could not save profile. Please try again.' });
        }
        setSaving(false);
    };

    const handleSecuritySave = async () => {
        if (!user) return;
        const email = securityForm.email.trim().toLowerCase();
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

        if (!EMAIL_REGEX.test(email)) return setSecurityMsg({ type: 'error', text: 'Enter a valid email address.' });
        if ((securityForm.newPassword || securityForm.confirmPassword) && !STRONG_PASSWORD_REGEX.test(securityForm.newPassword)) {
            return setSecurityMsg({ type: 'error', text: 'New password must be 8+ chars with uppercase, lowercase, number, and symbol.' });
        }
        if (securityForm.newPassword !== securityForm.confirmPassword) {
            return setSecurityMsg({ type: 'error', text: 'New password and confirm password do not match.' });
        }

        const needsSensitiveUpdate = email !== (user.email || '') || Boolean(securityForm.newPassword);
        if (needsSensitiveUpdate && !securityForm.currentPassword) {
            return setSecurityMsg({ type: 'error', text: 'Current password is required for email/password changes.' });
        }
        if (!needsSensitiveUpdate) {
            return setSecurityMsg({ type: 'error', text: 'No account security changes detected.' });
        }

        setSaving(true);
        setSecurityMsg({ type: 'info', text: 'Updating account credentials...' });
        try {
            if (needsSensitiveUpdate) {
                const credential = EmailAuthProvider.credential(user.email || '', securityForm.currentPassword);
                await reauthenticateWithCredential(user, credential);
            }
            if (email !== (user.email || '')) await updateEmail(user, email);
            if (securityForm.newPassword) await updatePassword(user, securityForm.newPassword);

            await setDoc(doc(db, 'users', user.uid), {
                email,
                displayName: form.fullName.trim(),
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            setSecurityForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
            setSecurityMsg({ type: 'success', text: 'Password/email updated successfully.' });
            setAccountMsg({ type: 'success', text: 'Account details updated.' });
        } catch (e: any) {
            const code = e?.code || '';
            if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setSecurityMsg({ type: 'error', text: 'Current password is incorrect.' });
            } else if (code === 'auth/email-already-in-use') {
                setSecurityMsg({ type: 'error', text: 'That email is already in use.' });
            } else if (code === 'auth/too-many-requests') {
                setSecurityMsg({ type: 'error', text: 'Too many attempts. Please wait and try again.' });
            } else {
                setSecurityMsg({ type: 'error', text: e?.message || 'Could not update account credentials.' });
            }
        }
        setSaving(false);
    };

    const handleLogout = async () => {
        setLoggingOut(true);
        try {
            await signOut(auth);
            setAccountMsg({ type: 'success', text: 'Signed out successfully.' });
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                // Single controlled refresh after logout (no extra route animation).
                window.location.replace('/');
            }
        } catch (e) {
            setAccountMsg({ type: 'error', text: 'Sign out failed. Please try again.' });
            console.error('Sign out error:', e);
        } finally {
            setLoggingOut(false);
        }
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
                        {'\u{1F4CD} Used to calculate accurate shuttle fares. Tap "Update" anytime you move residence.'}
                    </Text>
                </View>

                {/* Save */}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving
                        ? <ActivityIndicator color="#fff" />
                        : <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.saveBtnText}>Save Profile</Text></>
                    }
                </TouchableOpacity>
                {accountMsg && (
                    <View style={[styles.inlineMsg, accountMsg.type === 'success' ? styles.msgSuccess : accountMsg.type === 'info' ? styles.msgInfo : styles.msgError]}>
                        <Text style={styles.inlineMsgText}>{accountMsg.text}</Text>
                    </View>
                )}

                <View style={styles.card}>
                    <Text style={styles.sectionLabel}>Account Security</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email</Text>
                        <View style={styles.inputRow}>
                            <Ionicons name="mail-outline" size={18} color={C.dim} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                value={securityForm.email}
                                onChangeText={(v) => setSecurityForm((prev) => ({ ...prev, email: v }))}
                                placeholder="Enter email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholderTextColor={C.dim}
                            />
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Current Password</Text>
                        <View style={styles.inputRow}>
                            <Ionicons name="lock-closed-outline" size={18} color={C.dim} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                value={securityForm.currentPassword}
                                onChangeText={(v) => setSecurityForm((prev) => ({ ...prev, currentPassword: v }))}
                                placeholder="Required for email/password changes"
                                secureTextEntry
                                placeholderTextColor={C.dim}
                            />
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>New Password</Text>
                        <View style={styles.inputRow}>
                            <Ionicons name="key-outline" size={18} color={C.dim} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                value={securityForm.newPassword}
                                onChangeText={(v) => setSecurityForm((prev) => ({ ...prev, newPassword: v }))}
                                placeholder="Leave blank to keep current password"
                                secureTextEntry
                                placeholderTextColor={C.dim}
                            />
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Confirm New Password</Text>
                        <View style={styles.inputRow}>
                            <Ionicons name="checkmark-done-outline" size={18} color={C.dim} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.input}
                                value={securityForm.confirmPassword}
                                onChangeText={(v) => setSecurityForm((prev) => ({ ...prev, confirmPassword: v }))}
                                placeholder="Confirm password"
                                secureTextEntry
                                placeholderTextColor={C.dim}
                            />
                        </View>
                    </View>
                    <Text style={styles.locationHint}>Password rule: 8+ chars with uppercase, lowercase, number, and symbol.</Text>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSecuritySave} disabled={saving}>
                        {saving
                            ? <ActivityIndicator color="#fff" />
                            : <><Ionicons name="shield-checkmark" size={20} color="#fff" /><Text style={styles.saveBtnText}>Update Account Credentials</Text></>
                        }
                    </TouchableOpacity>
                    {securityMsg && (
                        <View style={[styles.inlineMsg, securityMsg.type === 'success' ? styles.msgSuccess : securityMsg.type === 'info' ? styles.msgInfo : styles.msgError]}>
                            <Text style={styles.inlineMsgText}>{securityMsg.text}</Text>
                        </View>
                    )}
                </View>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={loggingOut}>
                    {loggingOut ? (
                        <ActivityIndicator color={C.error} />
                    ) : (
                        <>
                            <Ionicons name="log-out-outline" size={20} color={C.error} />
                            <Text style={styles.logoutText}>Sign Out</Text>
                        </>
                    )}
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
    inlineMsg: {
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12,
        borderWidth: 1,
    },
    msgSuccess: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
    msgError: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    msgInfo: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
    inlineMsgText: { fontSize: 12, fontWeight: '700', color: '#334155' },

    version: { textAlign: 'center', color: C.dim, fontSize: 12, fontWeight: '500' },
});
