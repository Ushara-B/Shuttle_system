import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LogOut, Scan, CheckCircle2, XCircle, Bus, Edit2, MapPin, ArrowRightLeft } from 'lucide-react';

// Fix Leaflet default marker icons
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

const DriverDashboard = () => {
    const [studentId, setStudentId] = useState('');
    const [pricePerKm, setPricePerKm] = useState(() => {
        const saved = localStorage.getItem('shuttle_pricePerKm');
        return saved ? Number(saved) : 10;
    });
    const [editingPrice, setEditingPrice] = useState(false);
    const [priceInput, setPriceInput] = useState(pricePerKm);
    const [direction, setDirection] = useState(() => {
        return localStorage.getItem('shuttle_direction') || 'home-to-campus';
    });
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ revenue: 0, trips: 0 });
    const [scanning, setScanning] = useState(false);
    const [scanMarkers, setScanMarkers] = useState([]);
    const [lastResult, setLastResult] = useState(null);
    const scannerRef = useRef(null);
    const scannerInstanceRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
        return onSnapshot(q, (snapshot) => {
            let revenue = 0, trips = 0;
            const markers = [];
            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.type === 'fare-deduction') {
                    revenue += Math.abs(d.amount);
                    trips++;
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
        });
    }, []);

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
                    setStudentId(decodedText);
                    stopScanner();
                    processPayment(decodedText);
                },
                () => { }
            );
            setScanning(true);
            setStatus(null);
        } catch (err) {
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

    useEffect(() => () => { if (scanning) stopScanner(); }, []);

    const processPayment = async (uid) => {
        setLoading(true);
        setStatus(null);
        setLastResult(null);

        // Try to get the browser's GPS for distance calculation
        let lat = null, lng = null;
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true });
            });
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
        } catch {
            console.warn("GPS unavailable — using flat fare fallback");
        }

        try {
            const body = {
                studentUid: uid,
                driverUid: auth.currentUser?.uid,
                direction,
                pricePerKm,
                route: direction === 'home-to-campus' ? 'Home → Campus' : 'Campus → Home',
            };

            // Add GPS data if available
            if (lat && lng) {
                body.latitude = lat;
                body.longitude = lng;
            } else {
                body.farePrice = pricePerKm * 5; // Fallback: assume 5km
            }

            const res = await fetch('http://localhost:5000/api/transactions/scan', {
                method: 'POST',
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
                setStudentId('');
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

    const handleSetPrice = (e) => {
        e.preventDefault();
        setPricePerKm(priceInput);
        localStorage.setItem('shuttle_pricePerKm', priceInput);
        setEditingPrice(false);
    };

    const handleDirectionChange = (dir) => {
        setDirection(dir);
        localStorage.setItem('shuttle_direction', dir);
    };

    return (
        <div className="driver-page">
            <nav className="driver-nav">
                <div className="driver-nav-brand"><Bus size={22} /> Driver Console</div>
                <button className="driver-logout" onClick={() => auth.signOut()}>
                    <LogOut size={16} /> Logout
                </button>
            </nav>

            <div className="driver-layout">
                {/* LEFT COLUMN: Direction + Scanner */}
                <div className="driver-col-left">
                    {/* Direction Toggle */}
                    <div className="direction-card">
                        <div className="direction-label">Trip Direction</div>
                        <div className="direction-toggle">
                            <button
                                className={`dir-btn ${direction === 'home-to-campus' ? 'active' : ''}`}
                                onClick={() => handleDirectionChange('home-to-campus')}
                            >
                                🏠 Home → 🏫 Campus
                            </button>
                            <button
                                className={`dir-btn ${direction === 'campus-to-home' ? 'active' : ''}`}
                                onClick={() => handleDirectionChange('campus-to-home')}
                            >
                                🏫 Campus → 🏠 Home
                            </button>
                        </div>
                    </div>

                    {/* Fare Price per KM */}
                    <div className="fare-badge">
                        <div className="fare-badge-label">Price Per Kilometer</div>
                        {editingPrice ? (
                            <form onSubmit={handleSetPrice} className="fare-edit-form">
                                <input
                                    type="number" value={priceInput} min="1" autoFocus
                                    onChange={e => setPriceInput(Number(e.target.value))}
                                    className="fare-input"
                                />
                                <button type="submit" className="fare-save-btn">Save</button>
                                <button type="button" className="fare-cancel-btn" onClick={() => setEditingPrice(false)}>✕</button>
                            </form>
                        ) : (
                            <div className="fare-display">
                                <span className="fare-amount">Rs. {pricePerKm}/km</span>
                                <button className="fare-edit-btn" onClick={() => { setPriceInput(pricePerKm); setEditingPrice(true); }}>
                                    <Edit2 size={16} /> Edit
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Scanner */}
                    <div className="scanner-card">
                        <div className="scanner-title"><Scan size={20} /> Scan Student QR</div>
                        <div className={`scanner-viewfinder ${scanning ? 'active' : ''}`}>
                            <div className="corner tl" /><div className="corner tr" />
                            <div className="corner bl" /><div className="corner br" />
                            <div id="qr-reader" ref={scannerRef} style={{ width: '100%', height: '100%', borderRadius: '10px', overflow: 'hidden' }} />
                            {!scanning && (
                                <div className="scanner-placeholder">
                                    <Scan size={48} strokeWidth={1.5} color="#6366f1" />
                                    <p>Camera is off</p>
                                </div>
                            )}
                            {scanning && <div className="scan-laser" />}
                        </div>
                        <div className="scanner-actions">
                            {!scanning ? (
                                <button className="btn-primary" onClick={startScanner} disabled={loading}>
                                    Open Camera & Scan
                                </button>
                            ) : (
                                <button className="btn-danger" onClick={stopScanner}>Stop Camera</button>
                            )}
                        </div>
                        {loading && <div className="status-processing">Processing payment…</div>}
                        {status && !loading && (
                            <div className={`status-result ${status.type}`}>
                                {status.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                <div>
                                    <p style={{ fontWeight: 700 }}>{status.message}</p>
                                    {lastResult && (
                                        <p style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: 4 }}>
                                            Student balance: Rs. {lastResult.balance}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Stats + Map */}
                <div className="driver-col-right">
                    <div className="stats-card">
                        <div className="stat-block">
                            <p className="stat-label">Today's Revenue</p>
                            <h2 className="stat-value green">Rs. {stats.revenue}</h2>
                        </div>
                        <div className="stat-divider" />
                        <div className="stat-block">
                            <p className="stat-label">Total Scans</p>
                            <h2 className="stat-value purple">{stats.trips}</h2>
                        </div>
                    </div>

                    {/* Live Map */}
                    <div className="map-card">
                        <h3 className="map-title"><MapPin size={18} /> Scan Locations</h3>
                        <div className="map-wrapper">
                            <MapContainer
                                center={[CAMPUS.lat, CAMPUS.lng]}
                                zoom={12}
                                style={{ width: '100%', height: '100%', borderRadius: '12px' }}
                                scrollWheelZoom={true}
                            >
                                <TileLayer
                                    attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <Marker position={[CAMPUS.lat, CAMPUS.lng]} icon={campusIcon}>
                                    <Popup>🏫 University Campus</Popup>
                                </Marker>
                                {scanMarkers.map((m, i) => (
                                    <Marker key={i} position={[m.lat, m.lng]} icon={scanIcon}>
                                        <Popup>
                                            Rs. {m.fare} | {m.distance}km
                                        </Popup>
                                    </Marker>
                                ))}
                            </MapContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;
