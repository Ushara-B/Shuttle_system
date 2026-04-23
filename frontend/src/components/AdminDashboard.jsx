import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Users,
  Wallet,
  Route,
  UserPlus,
  Search,
  LogOut,
  Save,
  History,
  Settings,
  UserCog,
  LayoutDashboard,
  BarChart3,
  Filter,
  ShieldCheck,
  UserCircle2
} from 'lucide-react';
import { apiFetch } from '../utils/api';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'tokens', label: 'Token Management', icon: Wallet },
  { id: 'trips', label: 'Trip Settings', icon: Route },
  { id: 'history', label: 'History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'governance', label: 'Governance', icon: ShieldCheck },
];

const roleOptions = ['student', 'driver', 'admin'];

const dateKey = (value) => {
  if (!value) return 'N/A';
  if (typeof value === 'string') return value;
  if (value.toDate) return value.toDate().toISOString().slice(0, 10);
  return 'N/A';
};

const buildLastNDays = (payments, days = 7) => {
  const map = new Map();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  payments.forEach((p) => {
    if (p.type !== 'fare-deduction') return;
    const k = p.dateKey || dateKey(p.timestamp);
    if (map.has(k)) map.set(k, map.get(k) + Math.abs(p.amount || 0));
  });
  return [...map.entries()].map(([day, value]) => ({ day: day.slice(5), value }));
};

const SimpleBars = ({ data }) => {
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

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [users, setUsers] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [globalPricePerKm, setGlobalPricePerKm] = useState(10);
  const [globalPriceInput, setGlobalPriceInput] = useState(10);
  const [status, setStatus] = useState({ type: '', text: '' });
  const [search, setSearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState({ type: 'all', direction: 'all', studentUid: '' });

  const [userForm, setUserForm] = useState({
    role: 'student',
    displayName: '',
    email: '',
    password: '',
    studentId: '',
  });
  const [tokenForm, setTokenForm] = useState({ studentUid: '', amount: '' });
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [driverPrices, setDriverPrices] = useState({});

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubscribeWallets = onSnapshot(collection(db, 'wallets'), (snapshot) => {
      setWallets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubscribePayments = onSnapshot(query(collection(db, 'payments'), orderBy('timestamp', 'desc')), (snapshot) => {
      setPayments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubscribePricing = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
      const saved = docSnap.exists() ? docSnap.data().defaultPricePerKm : null;
      const safePrice = typeof saved === 'number' ? saved : 10;
      setGlobalPricePerKm(safePrice);
      setGlobalPriceInput(safePrice);
    });
    return () => {
      unsubscribeUsers();
      unsubscribeWallets();
      unsubscribePayments();
      unsubscribePricing();
    };
  }, []);

  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users]);
  const drivers = useMemo(() => users.filter((u) => u.role === 'driver'), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users]);

  const walletMap = useMemo(() => {
    const map = {};
    wallets.forEach((w) => { map[w.id] = w; });
    return map;
  }, [wallets]);

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const getStudentLabel = (uid) => {
    if (!uid) return 'Unknown Student';
    const user = userMap[uid];
    const wallet = walletMap[uid];
    if (!user) return uid;
    const name = user.displayName || user.email || uid;
    const sid = user.studentId || wallet?.studentId;
    return sid ? `${name} (${sid})` : name;
  };

  const filteredUsers = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return users;
    return users.filter((u) => {
      const name = (u.displayName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const sid = (u.studentId || '').toLowerCase();
      return name.includes(text) || email.includes(text) || sid.includes(text);
    });
  }, [users, search]);

  const filteredHistory = useMemo(() => {
    return payments.filter((p) => {
      if (historyFilter.type !== 'all' && p.type !== historyFilter.type) return false;
      if (historyFilter.direction !== 'all' && p.direction !== historyFilter.direction) return false;
      if (historyFilter.studentUid && p.studentUid !== historyFilter.studentUid) return false;
      return true;
    });
  }, [payments, historyFilter]);

  const selectedStudentEvents = useMemo(() => {
    if (!tokenForm.studentUid) return [];
    return payments.filter((p) => p.studentUid === tokenForm.studentUid).slice(0, 20);
  }, [payments, tokenForm.studentUid]);

  const tokenProfiles = useMemo(() => {
    return students.map((s) => ({
      uid: s.id,
      name: s.displayName || s.email || s.id,
      studentId: s.studentId || walletMap[s.id]?.studentId || 'N/A',
      balance: walletMap[s.id]?.balance || 0,
      updatedAt: walletMap[s.id]?.updatedAt || null,
    }));
  }, [students, walletMap]);

  const totalRevenue = useMemo(
    () => payments.filter((p) => p.type === 'fare-deduction').reduce((sum, p) => sum + Math.abs(p.amount || 0), 0),
    [payments]
  );

  const chartData = useMemo(() => buildLastNDays(payments), [payments]);
  const currentUser = auth.currentUser;
  const currentName = currentUser?.displayName || currentUser?.email || 'Admin User';
  const currentRole = 'Administrator';
  const pageTitleMap = {
    overview: 'Overview',
    users: 'User Management',
    tokens: 'Token Management',
    trips: 'Trip Settings',
    history: 'History',
    analytics: 'Analytics',
    governance: 'Governance',
  };

  const showMessage = (type, text) => {
    setStatus({ type, text });
    setTimeout(() => setStatus({ type: '', text: '' }), 2600);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/admin/create-user', {
        method: 'POST',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to create user');
      setUserForm({ role: 'student', displayName: '', email: '', password: '', studentId: '' });
      showMessage('success', 'User created successfully');
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleTokenTopup = async (e) => {
    e.preventDefault();
    if (topupSubmitting) return;
    const amount = Number(tokenForm.amount);
    if (!tokenForm.studentUid || !amount || amount <= 0) {
      showMessage('error', 'Select a student and enter a valid amount');
      return;
    }
    const clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setTopupSubmitting(true);
    try {
      const response = await apiFetch('/api/admin/adjust-balance', {
        method: 'POST',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentUid: tokenForm.studentUid, amount, clientRequestId }),
      });
      const payload = await response.json();
      if (response.status === 409) throw new Error('Duplicate click blocked. Top-up already processed.');
      if (!response.ok) throw new Error(payload.error || 'Top-up failed');
      setTokenForm((prev) => ({ ...prev, amount: '' }));
      showMessage('success', 'Token top-up successful');
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      setTopupSubmitting(false);
    }
  };

  const handleSaveGlobalPrice = async (e) => {
    e.preventDefault();
    const price = Number(globalPriceInput);
    if (!price || price <= 0) return showMessage('error', 'Global price must be greater than 0');
    try {
      const response = await apiFetch('/api/admin/pricing/global', {
        method: 'POST',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultPricePerKm: price }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to update global price');
      showMessage('success', `Global fare set to Rs. ${price}/km`);
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  const handleSaveDriverPrice = async (driverUid) => {
    const price = Number(driverPrices[driverUid]);
    if (!price || price <= 0) return showMessage('error', 'Driver price must be greater than 0');
    try {
      const response = await apiFetch('/api/admin/pricing/driver', {
        method: 'POST',
        auth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverUid, defaultPricePerKm: price }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Failed to update driver price');
      showMessage('success', 'Driver price updated');
    } catch (error) {
      showMessage('error', error.message);
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Smart Shuttle Admin</div>
        <div className="admin-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`admin-nav-btn ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <Icon size={17} /> {item.label}
              </button>
            );
          })}
        </div>
      </aside>

      <main className="admin-content">
        <header className="admin-topbar">
          <div>
            <h1 className="admin-page-title">{pageTitleMap[activeSection] || 'Dashboard'}</h1>
            <p className="admin-page-subtitle">Smart Shuttle control center</p>
          </div>
          <div className="admin-user-actions">
            <div className="admin-user-chip">
              <UserCircle2 size={18} />
              <div>
                <p>{currentName}</p>
                <span>{currentRole}</span>
              </div>
            </div>
            <button className="admin-header-logout" onClick={() => auth.signOut()}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        <div className="admin-overview-grid">
          <div className="admin-kpi-card"><span>Total Students</span><strong>{students.length}</strong></div>
          <div className="admin-kpi-card"><span>Total Drivers</span><strong>{drivers.length}</strong></div>
          <div className="admin-kpi-card"><span>Total Revenue</span><strong>Rs. {totalRevenue}</strong></div>
          <div className="admin-kpi-card"><span>Total Transactions</span><strong>{payments.length}</strong></div>
        </div>
        {status.text && <div className={`admin-status ${status.type}`}>{status.text}</div>}

        {activeSection === 'overview' && (
          <section className="admin-panel-card">
            <div className="admin-section-header">
              <h2>Operations Overview</h2>
              <p>Executive view: usage, revenue pattern, and wallet health.</p>
            </div>
            <div className="admin-grid-2">
              <div className="admin-panel-card">
                <div className="admin-card-title"><BarChart3 size={18} /> Revenue Trend (Last 7 Days)</div>
                <SimpleBars data={chartData} />
              </div>
              <div className="admin-panel-card">
                <div className="admin-card-title"><Wallet size={18} /> Wallet Snapshot</div>
                <div className="admin-list">
                  {students.slice(0, 8).map((s) => (
                    <div key={s.id} className="admin-list-item">
                      <div><div className="admin-list-title">{s.displayName || s.email}</div><div className="admin-list-sub">{s.studentId || 'No ID'}</div></div>
                      <div className="admin-tag">Rs. {walletMap[s.id]?.balance || 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'users' && (
          <section className="admin-grid-2">
            <div className="admin-panel-card">
              <div className="admin-section-header"><h2>User Management</h2><p>Create and manage student, driver, and admin accounts.</p></div>
              <div className="admin-card-title"><UserPlus size={18} /> Add New User</div>
              <form className="admin-form-grid" onSubmit={handleCreateUser}>
                <select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
                <input placeholder="Display Name" value={userForm.displayName} onChange={(e) => setUserForm((p) => ({ ...p, displayName: e.target.value }))} required />
                <input type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} required />
                <input type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} required />
                {userForm.role === 'student' && <input placeholder="Student ID (optional)" value={userForm.studentId} onChange={(e) => setUserForm((p) => ({ ...p, studentId: e.target.value }))} />}
                <button type="submit" className="admin-primary-btn">Create Account</button>
              </form>
            </div>
            <div className="admin-panel-card">
              <div className="admin-card-title"><Search size={18} /> User Directory</div>
              <input className="admin-search-input" placeholder="Search by name, email, student ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="admin-list">
                {filteredUsers.map((u) => (
                  <div key={u.id} className="admin-list-item">
                    <div><div className="admin-list-title">{u.displayName || 'No Name'}</div><div className="admin-list-sub">{u.email}</div></div>
                    <div className="admin-tag">{u.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeSection === 'tokens' && (
          <section className="admin-grid-2">
            <div className="admin-panel-card">
              <div className="admin-section-header"><h2>Token Management</h2><p>Top up student wallets via proper form UI.</p></div>
              <form className="admin-form-grid" onSubmit={handleTokenTopup}>
                <select value={tokenForm.studentUid} onChange={(e) => setTokenForm((p) => ({ ...p, studentUid: e.target.value }))} required>
                  <option value="">Select student account</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {getStudentLabel(s.id)}
                    </option>
                  ))}
                </select>
                <input type="number" placeholder="Amount (Rs.)" value={tokenForm.amount} min="1" onChange={(e) => setTokenForm((p) => ({ ...p, amount: e.target.value }))} required />
                {tokenForm.studentUid && <div className="admin-help-text">Current balance: Rs. {walletMap[tokenForm.studentUid]?.balance || 0}</div>}
                <button type="submit" className="admin-primary-btn" disabled={topupSubmitting}>
                  {topupSubmitting ? 'Processing...' : 'Confirm Top-up'}
                </button>
              </form>
            </div>
            <div className="admin-panel-card">
              <div className="admin-card-title"><Wallet size={18} /> Student Token Profiles (1 profile per student)</div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Student</th><th>Student ID</th><th>Balance</th><th>Last Update</th></tr></thead>
                  <tbody>
                    {tokenProfiles.map((profile) => (
                      <tr key={profile.uid}>
                        <td>{profile.name}</td>
                        <td>{profile.studentId}</td>
                        <td className="pos">Rs. {profile.balance}</td>
                        <td>{dateKey(profile.updatedAt)}</td>
                      </tr>
                    ))}
                    {tokenProfiles.length === 0 && (
                      <tr><td colSpan={4} className="admin-empty-cell">No student token profiles found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="admin-card-title" style={{ marginTop: '0.85rem' }}>
                <History size={18} /> {tokenForm.studentUid ? `Transactions: ${getStudentLabel(tokenForm.studentUid)}` : 'Select a student to view transactions'}
              </div>
              {tokenForm.studentUid && (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Type</th><th>Amount</th><th>Date</th></tr></thead>
                    <tbody>
                      {selectedStudentEvents.map((p) => (
                        <tr key={p.id}>
                          <td>{p.type}</td>
                          <td className={p.amount < 0 ? 'neg' : 'pos'}>Rs. {Math.abs(p.amount || 0)}</td>
                          <td>{p.dateKey || dateKey(p.timestamp)}</td>
                        </tr>
                      ))}
                      {selectedStudentEvents.length === 0 && (
                        <tr><td colSpan={3} className="admin-empty-cell">No events for selected student yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === 'trips' && (
          <section className="admin-grid-2">
            <div className="admin-panel-card">
              <div className="admin-section-header"><h2>Trip Settings</h2><p>Configure global pricing policy and fallback rules.</p></div>
              <form className="admin-inline-form" onSubmit={handleSaveGlobalPrice}>
                <input type="number" min="1" value={globalPriceInput} onChange={(e) => setGlobalPriceInput(e.target.value)} />
                <button type="submit" className="admin-primary-btn inline"><Save size={14} /> Save</button>
              </form>
              <div className="admin-help-text">Current global default: Rs. {globalPricePerKm}/km</div>
            </div>
            <div className="admin-panel-card">
              <div className="admin-card-title"><UserCog size={18} /> Driver-specific Rs/km</div>
              <div className="admin-list">
                {drivers.map((driver) => (
                  <div key={driver.id} className="admin-list-item admin-driver-row">
                    <div><div className="admin-list-title">{driver.displayName || driver.email}</div><div className="admin-list-sub">{driver.email}</div></div>
                    <div className="admin-driver-actions">
                      <input type="number" min="1" placeholder={String(driver.driverPricing?.defaultPricePerKm || globalPricePerKm)} value={driverPrices[driver.id] ?? ''} onChange={(e) => setDriverPrices((p) => ({ ...p, [driver.id]: e.target.value }))} />
                      <button className="admin-secondary-btn" onClick={() => handleSaveDriverPrice(driver.id)}>Set</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeSection === 'history' && (
          <section className="admin-panel-card">
            <div className="admin-section-header"><h2>Trip & Payment History</h2><p>Track by student, type, and direction for audit analysis.</p></div>
            <div className="admin-filter-row">
              <div className="admin-card-title"><Filter size={16} /> Filters</div>
              <select value={historyFilter.type} onChange={(e) => setHistoryFilter((p) => ({ ...p, type: e.target.value }))}>
                <option value="all">All types</option><option value="fare-deduction">Fare deduction</option><option value="top-up">Top-up</option>
              </select>
              <select value={historyFilter.direction} onChange={(e) => setHistoryFilter((p) => ({ ...p, direction: e.target.value }))}>
                <option value="all">All directions</option><option value="home-to-campus">Home to Campus</option><option value="campus-to-home">Campus to Home</option>
              </select>
              <select value={historyFilter.studentUid} onChange={(e) => setHistoryFilter((p) => ({ ...p, studentUid: e.target.value }))}>
                <option value="">All students</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.email}</option>)}
              </select>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Student</th><th>Driver</th><th>Type</th><th>Direction</th><th>Amount</th><th>Date</th></tr></thead>
                <tbody>
                  {filteredHistory.slice(0, 80).map((p) => (
                    <tr key={p.id}>
                      <td>{p.studentName || getStudentLabel(p.studentUid)}</td>
                      <td>{p.driverUid || '-'}</td>
                      <td>{p.type}</td>
                      <td>{p.direction || '-'}</td>
                      <td className={p.amount < 0 ? 'neg' : 'pos'}>Rs. {Math.abs(p.amount || 0)}</td>
                      <td>{p.dateKey || dateKey(p.timestamp)}</td>
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
              <div className="admin-card-title"><BarChart3 size={18} /> Daily Revenue Pattern</div>
              <SimpleBars data={chartData} />
            </div>
            <div className="admin-panel-card">
              <div className="admin-card-title"><Users size={18} /> Capacity Insights</div>
              <div className="admin-list">
                <div className="admin-list-item"><span>Students</span><strong>{students.length}</strong></div>
                <div className="admin-list-item"><span>Drivers</span><strong>{drivers.length}</strong></div>
                <div className="admin-list-item"><span>Admins</span><strong>{admins.length}</strong></div>
                <div className="admin-list-item"><span>Avg. revenue / trip</span><strong>Rs. {payments.length ? Math.round(totalRevenue / payments.length) : 0}</strong></div>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'governance' && (
          <section className="admin-panel-card">
            <div className="admin-section-header">
              <h2>Governance & Security</h2>
              <p>Recommended controls for production-grade shuttle operations.</p>
            </div>
            <div className="admin-list">
              <div className="admin-list-item"><span>Role-based policy</span><span className="admin-tag">Enabled</span></div>
              <div className="admin-list-item"><span>Pricing governance</span><span className="admin-tag">Driver + Global</span></div>
              <div className="admin-list-item"><span>Duplicate scan control</span><span className="admin-tag">Enabled</span></div>
              <div className="admin-list-item"><span>Next recommended</span><span className="admin-tag">Audit log export</span></div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
