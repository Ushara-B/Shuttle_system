import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { LogOut, QrCode, TrendingUp, Bus } from 'lucide-react';

const DriverDashboard = () => {
    const [studentId, setStudentId] = useState('');
    const [fare, setFare] = useState(50);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ revenue: 0, trips: 0 });

    // Listen to trip logs for today
    useEffect(() => {
        const q = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let revenue = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.type === 'fare-deduction') revenue += Math.abs(data.amount);
            });
            setStats({ revenue, trips: snapshot.size });
        });
        return () => unsubscribe();
    }, []);

    const handleScan = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);

        try {
            const response = await fetch('http://localhost:5000/api/transactions/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentUid: studentId,
                    farePrice: fare,
                    driverUid: auth.currentUser?.uid,
                    route: 'Route A'
                }),
            });

            const data = await response.json();
            if (response.ok) {
                setStatus({ type: 'success', message: `Success! Rs. ${fare} deducted.` });
                setStudentId('');
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Failed to connect to server' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="driver-dashboard">
            <nav className="top-nav">
                <div className="nav-brand"><Bus /> Driver Console</div>
                <button className="logout-mini" onClick={() => auth.signOut()}>
                    <LogOut size={18} /> Logout
                </button>
            </nav>

            <div className="dashboard-content">
                <div className="stats-row">
                    <div className="stat-card">
                        <TrendingUp color="#22c55e" />
                        <div>
                            <p>Today's Revenue</p>
                            <h3>Rs. {stats.revenue}</h3>
                        </div>
                    </div>
                    <div className="stat-card">
                        <QrCode color="#6366f1" />
                        <div>
                            <p>Total Scans</p>
                            <h3>{stats.trips}</h3>
                        </div>
                    </div>
                </div>

                <div className="scanner-section">
                    <div className="card-header">
                        <h2>Fare Collection</h2>
                        <p>Scan student QR or enter ID</p>
                    </div>

                    <form onSubmit={handleScan}>
                        <div className="input-field">
                            <label>Student ID / Scan Result</label>
                            <input
                                type="text"
                                value={studentId}
                                onChange={(e) => setStudentId(e.target.value)}
                                placeholder="Paste scan result here"
                                required
                            />
                        </div>
                        <div className="input-field">
                            <label>Fare (Rs.)</label>
                            <input
                                type="number"
                                value={fare}
                                onChange={(e) => setFare(Number(e.target.value))}
                            />
                        </div>
                        <button className="scan-btn" type="submit" disabled={loading}>
                            {loading ? 'Processing...' : 'Collect Fare'}
                        </button>
                    </form>

                    {status && (
                        <div className={`status-banner ${status.type}`}>
                            {status.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DriverDashboard;
