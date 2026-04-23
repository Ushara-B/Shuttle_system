import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { User, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Stack, Redirect } from 'expo-router';

export default function AuthScreen() {
    const [user, setUser] = useState<User | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError('Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#6366f1" />
            </View>
        );
    }

    if (user) {
        return <Redirect href="/(tabs)" />;
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.header}>
                <Image
                    source={require('../assets/smart_shuttle_icon.png')}
                    style={styles.logo}
                    resizeMode="contain"
                />
                <Text style={styles.title}>Smart Shuttle</Text>
                <Text style={styles.subtitle}>Student Wallet & Tracker</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="student@university.com"
                        placeholderTextColor="#94a3b8"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                    style={[styles.button, loading && styles.disabled]}
                    onPress={handleLogin}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Sign In</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Need help? Contact support</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 24,
        justifyContent: 'center'
    },
    center: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        alignItems: 'center',
        marginBottom: 48
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 16
    },
    title: {
        fontSize: 34,
        fontWeight: '900',
        color: '#111827',
        letterSpacing: -1
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 4,
        fontWeight: '500'
    },
    form: {
        width: '100%'
    },
    inputContainer: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
        marginLeft: 4
    },
    input: {
        backgroundColor: '#F9FAFB',
        color: '#111827',
        padding: 16,
        borderRadius: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2
    },
    button: {
        backgroundColor: '#4F46E5',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6
    },
    disabled: {
        opacity: 0.6
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700'
    },
    errorText: {
        color: '#EF4444',
        marginBottom: 20,
        textAlign: 'center',
        fontWeight: '600'
    },
    footer: {
        marginTop: 32,
        alignItems: 'center'
    },
    footerText: {
        color: '#94A3B8',
        fontSize: 14,
        fontWeight: '500'
    }
});
