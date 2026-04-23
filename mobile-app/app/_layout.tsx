import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Animated } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const fadeAnim = useState(() => new Animated.Value(0))[0];

    useEffect(() => {
        async function prepare() {
            try {
                await new Promise(resolve => setTimeout(resolve, 1800));
            } catch (e) {
                console.warn(e);
            } finally {
                setAppIsReady(true);
            }
        }
        prepare();
    }, []);

    useEffect(() => {
        if (appIsReady) {
            SplashScreen.hideAsync();
            Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
        }
    }, [appIsReady]);

    if (!appIsReady) {
        return (
            <View style={styles.splashContainer}>
                <Image
                    source={require('../assets/smart_shuttle_icon.png')}
                    style={styles.splashLogo}
                    resizeMode="contain"
                />
                <Text style={styles.splashTitle}>Smart Shuttle</Text>
                <Text style={styles.splashSubtitle}>Connecting Campus</Text>
            </View>
        );
    }

    return (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                    name="settings"
                    options={{
                        title: 'Settings',
                        headerStyle: { backgroundColor: '#13132B' },
                        headerTintColor: '#F1F5F9',
                        headerTitleStyle: { fontWeight: '800' },
                    }}
                />
            </Stack>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    splashContainer: {
        flex: 1, backgroundColor: '#F5F6FA',
        alignItems: 'center', justifyContent: 'center',
    },
    splashLogo: { width: 150, height: 150, marginBottom: 24 },
    splashTitle: { fontSize: 42, fontWeight: '900', color: '#7C3AED', letterSpacing: -1 },
    splashSubtitle: {
        fontSize: 18, color: '#6B7280', marginTop: 8,
        fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase',
    },
});
