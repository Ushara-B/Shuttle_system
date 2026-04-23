import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { Html5Qrcode } from 'html5-qrcode';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    LogOut,
    Scan,
    CheckCircle2,
    XCircle,
    Bus,
    Edit2,
    MapPin,
    History,
    BarChart3,
    Settings,
    LayoutDashboard,
    UserCircle2,
    Lock
} from 'lucide-react';
import { apiFetch } from '../utils/api';

// Leaflet needs explicit marker icon URLs when bundled.
// Without this, markers can appear as broken images in production builds.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CAMPUS = { lat: 6.9036, lng: 79.9547 };

const campusIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const scanIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const buildLastNDays = (payments, days = 7) => {
    // Build driver revenue trend for a mini 7-day chart.
    // Uses dateKey to keep aggregation stable.
    const map = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        map.set(d.toISOString().slice(0, 10), 0);
    }
    payments.forEach((p) => {
        const k = p.dateKey || (p.timestamp?.toDate ? p.timestamp.toDate().toISOString().slice(0, 10) : null);
        if (k && map.has(k) && p.type === 'fare-deduction') {
            map.set(k, map.get(k) + Math.abs(p.amount || 0));
        }
    });
    return [...map.entries()].map(([day, value]) => ({ day: day.slice(5), value }));
};

const formatDirection = (dir) => {
    if (!dir) return '-';
    if (dir === 'home-to-campus') return 'Home → Campus';
    if (dir === 'campus-to-home') return 'Campus → Home';
    return dir;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Password rule mirrors admin/backend policy so users can't pick unsupported passwords.
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const mapAuthError = (error) => {
    // Convert Firebase Auth error codes into user-friendly messages.
    const code = error?.code || '';
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'Current password is incorrect.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait and try again.';
    if (code === 'auth/email-already-in-use') return 'That email is already in use by another account.';
    if (code === 'auth/invalid-email') return 'Email address is invalid.';
    if (code === 'auth/weak-password') return 'New password is too weak.';
    if (code === 'auth/requires-recent-login') return 'Please log out and log in again, then retry this change.';
    return error?.message || 'Failed to update profile.';
};

const MiniBars = ({ data }) => {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (
        <div className="mini-bars">
            {data.map((d) => (
                <div key={d.day} className="mini-bar-item">
                    <div className="mini-bar-track">
                        <div className="mini-bar-fill" style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }} />
                    </div>
                    <span>{d.day}</span>
                </div>
            ))}
        </div>
    );
};

const DriverDashboard = () => {
    const [activeSection, setActiveSection] = useState('scan');
    const [currentUid, setCurrentUid] = useState(() => auth.currentUser?.uid || null);
    const [pricePerKm, setPricePerKm] = useState(() => {
        const saved = localStorage.getItem('shuttle_pricePerKm');
        return saved ? Number(saved) : 10;
    });
    const [editingPrice, setEditingPrice] = useState(false);
    const [priceInput, setPriceInput] = useState(pricePerKm);
    const [direction, setDirection] = useState(() => {
        // Direction is driver-selected and persisted locally (per-device) to reduce clicks.
        return localStorage.getItem('shuttle_direction') || 'home-to-campus';
    });
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ revenue: 0, trips: 0 });
    const [scanning, setScanning] = useState(false);
    const [scanMarkers, setScanMarkers] = useState([]);
    const [recentTrips, setRecentTrips] = useState([]);
    const [lastResult, setLastResult] = useState(null);
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileForm, setProfileForm] = useState({ displayName: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [profileStatus, setProfileStatus] = useState(null);
    const scannerRef = useRef(null);
    const scannerInstanceRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
        return onSnapshot(q, (snapshot) => {
            // Driver dashboard stats are derived from Firestore payments (fare-deduction only).
            let revenue = 0, trips = 0;
            const markers = [];
            const driverTrips = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.type === 'fare-deduction' && d.driverUid === auth.currentUser?.uid) {
                    revenue += Math.abs(d.amount);
                    trips++;
                    driverTrips.push({ id: doc.id, ...d });
                    if (d.scanLocation) {
                        markers.push({
                            lat: d.scanLocation.latitude,
                            lng: d.scanLocation.longitude,
                            fare: Math.abs(d.amount),
                            distance: d.distanceKm,
                        });
                    }
                }
            });
            setStats({ revenue, trips });
            setScanMarkers(markers.slice(0, 20)); // Show last 20 pins
            setRecentTrips(driverTrips.slice(0, 30));
        });
    }, []);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => setCurrentUid(user?.uid || null));
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!auth.currentUser?.uid) return;
        const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
            if (!snap.exists()) return;
            const serverPrice = snap.data()?.driverPricing?.defaultPricePerKm;
            if (typeof serverPrice === 'number') {
                setPricePerKm(serverPrice);
                setPriceInput(serverPrice);
                localStorage.setItem('shuttle_pricePerKm', String(serverPrice));
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        // Persist direction per-driver to avoid cross-account collisions on shared devices.
        const uid = currentUid;
        if (!uid) return;
        const perDriverKey = `shuttle_direction_${uid}`;
        const saved = localStorage.getItem(perDriverKey) || localStorage.getItem('shuttle_direction');
        if (saved && saved !== direction) setDirection(saved);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUid]);

    useEffect(() => {
        setProfileForm((prev) => ({
            ...prev,
            displayName: auth.currentUser?.displayName || '',
            email: auth.currentUser?.email || '',
        }));
    }, [currentUid]);

    const startScanner = async () => {
        if (!scannerRef.current) return;
        try {
            const scanner = new Html5Qrcode("qr-reader");
            scannerInstanceRef.current = scanner;
            await scanner.start(
                { facingMode: "environment" },
                { fps: 15, qrbox: { width: 300, height: 300 } },
                (decodedText) => {
                    console.log("QR Detected:", decodedText);
                    stopScanner();
                    processPayment(decodedText);
                },
                () => { }
            );
            setScanning(true);
            setStatus(null);
        } catch {
            setStatus({ type: 'error', message: 'Could not access camera. Allow camera permissions and try again.' });
        }
    };

    const stopScanner = () => {
        if (scannerInstanceRef.current) {
            scannerInstanceRef.current.stop()
                .then(() => { scannerInstanceRef.current.clear(); scannerInstanceRef.current = null; })
                .catch(() => { });
        }
        setScanning(false);
    };

    useEffect(() => () => {
        if (scannerInstanceRef.current) stopScanner();
    }, []);

    const processPayment = async (uid) => {
        setLoading(true);
        setStatus(null);
        setLastResult(null);

        // Try to get the driver's GPS location for distance calculation.
        // If unavailable, backend falls back to student's saved home location.
        let lat = null, lng = null;
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000, enableHighAccuracy: true });
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
        } catch {
            console.warn("Driver GPS unavailable — backend will use student's saved home location.");
        }

        try {
            const body = {
                studentUid: uid,
                driverUid: auth.currentUser?.uid,
                direction,
                pricePerKm,
                route: direction === 'home-to-campus' ? 'Home → Campus' : 'Campus → Home',
            };

            // Only send GPS if we actually got a fix — never send a fabricated distance
            if (lat && lng) {
                body.latitude = lat;
                body.longitude = lng;
            }
            // No fallback farePrice anymore — the backend calculates it correctly

            const res = await apiFetch('/api/transactions/scan', {
                method: 'POST',
                auth: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (res.ok) {
                setLastResult({ fare: data.fare, distance: data.distanceKm, balance: data.balance, name: data.studentName });
                setStatus({
                    type: 'success',
                    message: data.distanceKm
                        ? `Rs. ${data.fare} collected from ${data.studentName} (${data.distanceKm}km × Rs.${pricePerKm}/km)`
                        : `Rs. ${data.fare} collected from ${data.studentName}`
                });
            } else if (res.status === 409) {
                setStatus({ type: 'error', message: `⚠️ ${data.error} (Rs. ${data.existingFare} already charged)` });
            } else {
                setStatus({ type: 'error', message: data.error || 'Payment failed' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Server connection failed' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveDriverDefault = async (e) => {
        e.preventDefault();
        const value = Number(priceInput);
        if (!value || value <= 0) {
            setStatus({ type: 'error', message: 'Price must be greater than zero' });
            return;
        }
        try {
            const res = await apiFetch('/api/driver/pricing', {
                method: 'POST',
                auth: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultPricePerKm: value }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save driver price');
            setPricePerKm(value);
            localStorage.setItem('shuttle_pricePerKm', String(value));
            setStatus({ type: 'success', message: `Default fare set to Rs. ${value}/km` });
            setEditingPrice(false);
        } catch (error) {
            setStatus({ type: 'error', message: error.message });
        }
    };

    const handleDirectionChange = (dir) => {
        setDirection(dir);
        localStorage.setItem('shuttle_direction', dir);
        const uid = currentUid;
        if (uid) localStorage.setItem(`shuttle_direction_${uid}`, dir);
    };

    const chartData = useMemo(() => buildLastNDays(recentTrips), [recentTrips]);
    const currentUser = auth.currentUser;
    const currentName = currentUser?.displayName || currentUser?.email || 'Driver';
    const pageTitleMap = {
        scan: 'Live Scan',
        history: 'Trip History',
        analytics: 'Analytics',
        settings: 'Settings',
        profile: 'Profile',
    };

    const nav = [
        { id: 'scan', label: 'Live Scan', icon: Scan },
        { id: 'history', label: 'Trip History', icon: History },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings },
        { id: 'profile', label: 'Profile', icon: UserCircle2 },
    ];

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!auth.currentUser) {
            setProfileStatus({ type: 'error', message: 'User session not found. Please log in again.' });
            return;
        }

        const nextDisplayName = profileForm.displayName.trim();
        const nextEmail = profileForm.email.trim().toLowerCase();
        const currentPassword = profileForm.currentPassword;
        const newPassword = profileForm.newPassword;
        const confirmPassword = profileForm.confirmPassword;

        if (!nextDisplayName) return setProfileStatus({ type: 'error', message: 'Display name is required.' });
        if (!EMAIL_REGEX.test(nextEmail)) return setProfileStatus({ type: 'error', message: 'Enter a valid email address.' });
        if ((newPassword || confirmPassword) && !STRONG_PASSWORD_REGEX.test(newPassword)) {
            return setProfileStatus({ type: 'error', message: 'New password must be 8+ chars with uppercase, lowercase, number, and symbol.' });
        }
        if (newPassword !== confirmPassword) return setProfileStatus({ type: 'error', message: 'New password and confirm password do not match.' });

        const needsSensitiveUpdate = nextEmail !== (auth.currentUser.email || '') || Boolean(newPassword);
        if (needsSensitiveUpdate && !currentPassword) {
            return setProfileStatus({ type: 'error', message: 'Current password is required for email/password changes.' });
        }
        const hasAnyChange =
            nextDisplayName !== (auth.currentUser.displayName || '') ||
            nextEmail !== (auth.currentUser.email || '') ||
            Boolean(newPassword);
        if (!hasAnyChange) {
            return setProfileStatus({ type: 'error', message: 'No changes detected. Update a field first.' });
        }

        setProfileSaving(true);
        setProfileStatus({ type: 'info', message: 'Saving profile changes...' });
        try {
            if (needsSensitiveUpdate) {
                const credential = EmailAuthProvider.credential(auth.currentUser.email || '', currentPassword);
                await reauthenticateWithCredential(auth.currentUser, credential);
            }
            if (nextDisplayName !== (auth.currentUser.displayName || '')) {
                await updateProfile(auth.currentUser, { displayName: nextDisplayName });
            }
            if (nextEmail !== (auth.currentUser.email || '')) {
                await updateEmail(auth.currentUser, nextEmail);
            }
            if (newPassword) {
                await updatePassword(auth.currentUser, newPassword);
            }
            await setDoc(doc(db, 'users', auth.currentUser.uid), {
                displayName: nextDisplayName,
                email: nextEmail,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            setProfileForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
            setProfileStatus({ type: 'success', message: 'Profile updated successfully. Password/email changes are now active.' });
        } catch (error) {
            setProfileStatus({ type: 'error', message: mapAuthError(error) });
        } finally {
            setProfileSaving(false);
        }
    };

    return (
        <div className="admin-shell driver-shell">
            <aside className="admin-sidebar">
                <div className="admin-brand"><Bus size={18} /> Driver Workspace</div>
                <div className="admin-nav">
                    {nav.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                className={`admin-nav-btn ${activeSection === item.id ? 'active' : ''}`}
                                onClick={() => setActiveSection(item.id)}
                            >
                                <Icon size={16} /> {item.label}
                            </button>
                        );
                    })}
                </div>
            </aside>

            <main className="admin-content">
                <header className="admin-topbar">
                    <div>
                        <h1 className="admin-page-title">{pageTitleMap[activeSection] || 'Driver Dashboard'}</h1>
                        <p className="admin-page-subtitle">Shuttle trip operations workspace</p>
                    </div>
                    <div className="admin-user-actions">
                        <div className="admin-user-chip">
                            <UserCircle2 size={18} />
                            <div>
                                <p>{currentName}</p>
                                <span>Driver</span>
                            </div>
                        </div>
                        <button className="admin-header-logout" onClick={() => auth.signOut()}>
                            <LogOut size={16} /> Logout
                        </button>
                    </div>
                </header>

                <div className="admin-overview-grid">
                    <div className="admin-kpi-card"><span>Total Revenue</span><strong>Rs. {stats.revenue}</strong></div>
                    <div className="admin-kpi-card"><span>Total Trips</span><strong>{stats.trips}</strong></div>
                    <div className="admin-kpi-card"><span>Current Price</span><strong>Rs. {pricePerKm}/km</strong></div>
                    <div className="admin-kpi-card"><span>Direction</span><strong>{direction === 'home-to-campus' ? 'Home -> Campus' : 'Campus -> Home'}</strong></div>
                </div>

                {activeSection === 'scan' && (
                    <section className="admin-grid-2">
                        <div className="admin-panel-card">
                            <div className="admin-card-title"><LayoutDashboard size={18} /> Live Trip Scan</div>
                            <div className="scanner-card">
                                <div className={`scanner-viewfinder ${scanning ? 'active' : ''}`}>
                                    <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
                                    <div id="qr-reader" ref={scannerRef} style={{ width: '100%', height: '100%', borderRadius: '10px', overflow: 'hidden' }} />
                                    {!scanning && <div className="scanner-placeholder"><Scan size={48} strokeWidth={1.5} color="#4f46e5" /><p>Camera is off</p></div>}
                                    {scanning && <div className="scan-laser" />}
                                </div>
                                <div className="scanner-actions">
                                    {!scanning ? <button className="btn-primary" onClick={startScanner} disabled={loading}>Open Camera & Scan</button> : <button className="btn-danger" onClick={stopScanner}>Stop Camera</button>}
                                </div>
                                {loading && <div className="status-processing">Processing payment...</div>}
                                {status && !loading && (
                                    <div className={`status-result ${status.type}`}>
                                        {status.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                        <div>
                                            <p style={{ fontWeight: 700 }}>{status.message}</p>
                                            {lastResult && <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 4 }}>Student balance: Rs. {lastResult.balance}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="admin-panel-card">
                            <h3 className="map-title"><MapPin size={18} /> Scan Locations</h3>
                            <div className="map-wrapper">
                                <MapContainer center={[CAMPUS.lat, CAMPUS.lng]} zoom={12} style={{ width: '100%', height: '100%', borderRadius: '12px' }} scrollWheelZoom>
                                    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <Marker position={[CAMPUS.lat, CAMPUS.lng]} icon={campusIcon}><Popup>University Campus</Popup></Marker>
                                    {scanMarkers.map((m, i) => (
                                        <Marker key={i} position={[m.lat, m.lng]} icon={scanIcon}>
                                            <Popup>Rs. {m.fare} | {m.distance}km</Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === 'history' && (
                    <section className="admin-panel-card">
                        <div className="admin-section-header">
                            <h2>Driver Trip History</h2>
                            <p>Recent trips collected by this driver.</p>
                        </div>
                        <div className="admin-table-wrap">
                            <table className="admin-table">
                                <thead>
                                    <tr><th>Student</th><th>Direction</th><th>Distance</th><th>Fare</th><th>Date</th></tr>
                                </thead>
                                <tbody>
                                    {recentTrips.map((t) => (
                                        <tr key={t.id}>
                                            <td>{t.studentName || t.studentUid}</td>
                                            <td>{formatDirection(t.direction)}</td>
                                            <td>{t.distanceKm ? `${t.distanceKm} km` : '-'}</td>
                                            <td>Rs. {Math.abs(t.amount || 0)}</td>
                                            <td>{t.dateKey || (t.timestamp?.toDate ? t.timestamp.toDate().toISOString().slice(0, 10) : '-')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {activeSection === 'analytics' && (
                    <section className="admin-grid-2">
                        <div className="admin-panel-card">
                            <div className="admin-card-title"><BarChart3 size={18} /> Revenue Trend (7 days)</div>
                            <MiniBars data={chartData} />
                        </div>
                        <div className="admin-panel-card">
                            <div className="admin-card-title"><History size={18} /> Summary</div>
                            <div className="admin-list">
                                <div className="admin-list-item"><span>Trips completed</span><strong>{stats.trips}</strong></div>
                                <div className="admin-list-item"><span>Total collected</span><strong>Rs. {stats.revenue}</strong></div>
                                <div className="admin-list-item"><span>Average fare</span><strong>Rs. {stats.trips ? Math.round(stats.revenue / stats.trips) : 0}</strong></div>
                            </div>
                        </div>
                    </section>
                )}

                {activeSection === 'settings' && (
                    <section className="admin-panel-card">
                        <div className="admin-section-header">
                            <h2>Settings</h2>
                            <p>Manage trip direction and fare pricing.</p>
                        </div>

                        <div className="direction-card" style={{ marginBottom: 16 }}>
                            <div className="direction-label">Default Trip Direction</div>
                            <div className="direction-toggle">
                                <button className={`dir-btn ${direction === 'home-to-campus' ? 'active' : ''}`} onClick={() => handleDirectionChange('home-to-campus')}>Home to Campus</button>
                                <button className={`dir-btn ${direction === 'campus-to-home' ? 'active' : ''}`} onClick={() => handleDirectionChange('campus-to-home')}>Campus to Home</button>
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: 8 }}>
                                Current: <strong>{formatDirection(direction)}</strong>
                            </div>
                        </div>

                        <div className="fare-badge">
                            <div className="fare-badge-label">Price Per Kilometer</div>
                            {editingPrice ? (
                                <form onSubmit={handleSaveDriverDefault} className="fare-edit-form">
                                    <input type="number" value={priceInput} min="1" autoFocus onChange={e => setPriceInput(Number(e.target.value))} className="fare-input" />
                                    <button type="submit" className="fare-save-btn">Save</button>
                                    <button type="button" className="fare-cancel-btn" onClick={() => setEditingPrice(false)}>Cancel</button>
                                </form>
                            ) : (
                                <div className="fare-display">
                                    <span className="fare-amount">Rs. {pricePerKm}/km</span>
                                    <button className="fare-edit-btn" onClick={() => { setPriceInput(pricePerKm); setEditingPrice(true); }}><Edit2 size={16} /> Edit</button>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {activeSection === 'profile' && (
                    <section className="admin-panel-card">
                        <div className="admin-section-header">
                            <h2>Profile</h2>
                            <p>Update your account details and password.</p>
                        </div>
                        <form className="admin-form-grid" onSubmit={handleUpdateProfile}>
                            <input
                                type="text"
                                placeholder="Display Name"
                                value={profileForm.displayName}
                                onChange={(e) => setProfileForm((p) => ({ ...p, displayName: e.target.value }))}
                                required
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                value={profileForm.email}
                                onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                                required
                            />
                            <div className="admin-card-title"><Lock size={16} /> Password Change</div>
                            <input
                                type="password"
                                placeholder="Current Password (required for email/password changes)"
                                value={profileForm.currentPassword}
                                onChange={(e) => setProfileForm((p) => ({ ...p, currentPassword: e.target.value }))}
                            />
                            <input
                                type="password"
                                placeholder="New Password"
                                value={profileForm.newPassword}
                                onChange={(e) => setProfileForm((p) => ({ ...p, newPassword: e.target.value }))}
                            />
                            <input
                                type="password"
                                placeholder="Confirm New Password"
                                value={profileForm.confirmPassword}
                                onChange={(e) => setProfileForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                            />
                            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Password rule: 8+ chars, uppercase, lowercase, number, symbol.</p>
                            {profileStatus && (
                                <div className={`status-result ${profileStatus.type === 'success' ? 'success' : profileStatus.type === 'info' ? 'info' : 'error'}`}>
                                    {profileStatus.type === 'success' ? <CheckCircle2 size={20} /> : profileStatus.type === 'info' ? <Settings size={20} /> : <XCircle size={20} />}
                                    <div>
                                        <p style={{ fontWeight: 700 }}>{profileStatus.message}</p>
                                    </div>
                                </div>
                            )}
                            <button className="admin-primary-btn" type="submit" disabled={profileSaving}>
                                {profileSaving ? 'Saving...' : 'Save Profile Changes'}
                            </button>
                        </form>
                    </section>
                )}
            </main>
        </div>
    );
};

export default DriverDashboard;
