import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Html5Qrcode } from 'html5-qrcode';
import { LogOut, TrendingUp, Scan, CheckCircle2, XCircle, Bus, Edit2 } from 'lucide-react';

const DriverDashboard = () => {
    const [studentId, setStudentId] = useState('');
    const [fare, setFare] = useState(50);
    const [fareInput, setFareInput] = useState(50);
    const [editingFare, setEditingFare] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ revenue: 0, trips: 0 });
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef(null);
    const scannerInstanceRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
        return onSnapshot(q, (snapshot) => {
            let revenue = 0, trips = 0;
            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.type === 'fare-deduction') { revenue += Math.abs(d.amount); trips++; }
            });
            setStats({ revenue, trips });
        });
    }, []);

    const startScanner = async () => {
        if (!scannerRef.current) return;
        try {
            const scanner = new Html5Qrcode("qr-reader");
            scannerInstanceRef.current = scanner;
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decodedText) => {
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
        try {
            const res = await fetch('http://localhost:5000/api/transactions/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentUid: uid, farePrice: fare, driverUid: auth.currentUser?.uid, route: 'Route A' }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: `Rs. ${fare} collected successfully!` });
                setStudentId('');
            } else {
                setStatus({ type: 'error', message: data.error || 'Payment failed' });
            }
        } catch {
            setStatus({ type: 'error', message: 'Server connection failed. Is the backend running?' });
        } finally {
            setLoading(false);
        }
    };

    const handleSetFare = (e) => {
        e.preventDefault();
        setFare(fareInput);
        setEditingFare(false);
    };

    return (
        <div className="driver-page">
            {/* Top Nav */}
            <nav className="driver-nav">
                <div className="driver-nav-brand"><Bus size={22} /> Driver Console</div>
                <button className="driver-logout" onClick={() => auth.signOut()}>
                    <LogOut size={16} /> Logout
                </button>
            </nav>

            <div className="driver-layout">
                {/* LEFT COLUMN: Scanner */}
                <div className="driver-col-left">
                    {/* Fare Badge */}
                    <div className="fare-badge">
                        <div className="fare-badge-label">Current Fare</div>
                        {editingFare ? (
                            <form onSubmit={handleSetFare} className="fare-edit-form">
                                <input
                                    type="number"
                                    value={fareInput}
                                    min="1"
                                    autoFocus
                                    onChange={e => setFareInput(Number(e.target.value))}
                                    className="fare-input"
                                />
                                <button type="submit" className="fare-save-btn">Save</button>
                                <button type="button" className="fare-cancel-btn" onClick={() => setEditingFare(false)}>✕</button>
                            </form>
                        ) : (
                            <div className="fare-display">
                                <span className="fare-amount">Rs. {fare}</span>
                                <button className="fare-edit-btn" onClick={() => { setFareInput(fare); setEditingFare(true); }}>
                                    <Edit2 size={16} /> Edit
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Scanner Viewfinder */}
                    <div className="scanner-card">
                        <div className="scanner-title">
                            <Scan size={20} /> Scan Student QR
                        </div>

                        <div className={`scanner-viewfinder ${scanning ? 'active' : ''}`}>
                            {/* Corner brackets */}
                            <div className="corner tl" /><div className="corner tr" />
                            <div className="corner bl" /><div className="corner br" />
                            {/* Camera feed or placeholder */}
                            <div id="qr-reader" ref={scannerRef} style={{ width: '100%', height: '100%', borderRadius: '10px', overflow: 'hidden' }} />
                            {!scanning && (
                                <div className="scanner-placeholder">
                                    <Scan size={48} strokeWidth={1.5} color="#6366f1" />
                                    <p>Camera is off</p>
                                </div>
                            )}
                            {/* Scanning laser animation */}
                            {scanning && <div className="scan-laser" />}
                        </div>

                        <div className="scanner-actions">
                            {!scanning ? (
                                <button className="btn-primary" onClick={startScanner} disabled={loading}>
                                    Open Camera & Scan
                                </button>
                            ) : (
                                <button className="btn-danger" onClick={stopScanner}>
                                    Stop Camera
                                </button>
                            )}
                        </div>

                        {/* Status Banner */}
                        {loading && <div className="status-processing">Processing payment…</div>}
                        {status && !loading && (
                            <div className={`status-result ${status.type}`}>
                                {status.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                                {status.message}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Stats */}
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
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;
