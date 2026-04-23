import React, { useEffect, useMemo, useState } from 'react';
import { auth, db } from '../firebase';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  Users, Wallet, Route, UserPlus, Search, LogOut, Save, History,
  Settings, UserCog, LayoutDashboard, BarChart3, Filter, ShieldCheck,
  UserCircle2, GraduationCap, Bus, Ticket, Bell
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import './Admin.css';

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Students & Users', icon: Users },
  { id: 'tokens', label: 'Tokens', icon: Ticket },
  { id: 'trips', label: 'Shuttle Services', icon: Bus },
  { id: 'history', label: 'Service History', icon: History },
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
    <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '1rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '1rem', border: '1px solid #e2e8f0', marginTop: '1rem' }}>
      {data.map((d) => (
        <div key={d.day} style={{ flex: 1, minWidth: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '100%', height: '180px', borderRadius: '0.75rem', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-end', padding: '0.25rem' }}>
            <div style={{ width: '100%', borderRadius: '0.5rem', background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)', height: `${Math.max(8, (d.value / max) * 100)}%` }} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{d.day}</span>
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
    overview: 'Dashboard',
    users: 'Students & Users',
    tokens: 'Token Management',
    trips: 'Shuttle Services',
    history: 'Service History',
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
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar-modern">
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-icon">
            <Bus size={20} />
          </div>
          <div className="admin-sidebar-title">
            <h2>Smart Shuttle</h2>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="admin-nav-modern">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`admin-nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-profile">
            <div className="admin-avatar">{currentName.charAt(0).toUpperCase()}</div>
            <div className="admin-user-info">
              <p>{currentName}</p>
              <span>{currentRole}</span>
            </div>
            <button className="admin-icon-action" style={{ color: '#ef4444', marginLeft: 'auto' }} onClick={() => auth.signOut()}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main-modern">
        {/* Topbar */}
        <header className="admin-topbar-modern">
          <div className="admin-topbar-left">
            <h1>{pageTitleMap[activeSection]}</h1>
          </div>
          <div className="admin-topbar-right">
            <div className="admin-search-wrapper">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="admin-icon-action">
              <Bell size={20} />
            </button>
            <div className="admin-avatar-sm">{currentName.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <div className="admin-content-scroll">

          {/* Top KPI Stats - rendered in all contexts per screenshot style, or just overview/users? Let's render always for the "Dashboard" feel */}
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <div className="admin-stat-details">
                <span className="admin-stat-label">Total Students</span>
                <div className="admin-stat-value">
                  {students.length}
                </div>
              </div>
              <div className="admin-stat-icon-wrapper bg-blue-light">
                <GraduationCap size={24} />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-details">
                <span className="admin-stat-label">Total Users</span>
                <div className="admin-stat-value">
                  {users.length}
                </div>
              </div>
              <div className="admin-stat-icon-wrapper bg-cyan-light">
                <Users size={24} />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-details">
                <span className="admin-stat-label">Transactions</span>
                <div className="admin-stat-value">
                  {payments.length}
                </div>
              </div>
              <div className="admin-stat-icon-wrapper bg-green-light">
                <Ticket size={24} />
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-details">
                <span className="admin-stat-label">Total Revenue</span>
                <div className="admin-stat-value" style={{ fontSize: '1.4rem' }}>
                  Rs. {totalRevenue}
                </div>
              </div>
              <div className="admin-stat-icon-wrapper bg-yellow-light">
                <Wallet size={24} />
              </div>
            </div>
          </div>

          {status.text && (
            <div className={`modern-status-msg ${status.type}`}>
              {status.type === 'error' ? <ShieldCheck size={18} /> : <Route size={18} />}
              {status.text}
            </div>
          )}

          {activeSection === 'overview' && (
            <section>
              <div className="admin-section-header-modern">
                <h2>Operations Overview</h2>
                <p>Usage, revenue pattern, and wallet health metrics.</p>
              </div>
              <div className="admin-grid-layout">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <BarChart3 size={18} color="#3b82f6" />
                    <h3>Revenue Trend (Last 7 Days)</h3>
                  </div>
                  <SimpleBars data={chartData} />
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <Wallet size={18} color="#06b6d4" />
                    <h3>Wallet Snapshot</h3>
                  </div>
                  <div className="admin-recent-list">
                    {students.slice(0, 8).map((s) => (
                      <div key={s.id} className="admin-recent-item">
                        <div className="admin-recent-item-info">
                          <span className="admin-recent-item-title">{s.displayName || s.email}</span>
                          <span className="admin-recent-item-sub">{s.studentId || 'No ID'}</span>
                        </div>
                        <span className="admin-badge badge-blue">Rs. {walletMap[s.id]?.balance || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'users' && (
            <section>
              <div className="admin-section-header-modern">
                <h2>User Management</h2>
                <p>Create and explore student, driver, and admin profiles.</p>
              </div>
              <div className="admin-grid-layout">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <UserPlus size={18} color="#10b981" />
                    <h3>Add New User</h3>
                  </div>
                  <form className="modern-form-grid" onSubmit={handleCreateUser}>
                    <select className="modern-select" value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value }))}>
                      {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <input className="modern-input" placeholder="Display Name" value={userForm.displayName} onChange={(e) => setUserForm((p) => ({ ...p, displayName: e.target.value }))} required />
                    <input className="modern-input" type="email" placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} required />
                    <input className="modern-input" type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} required />
                    {userForm.role === 'student' && <input className="modern-input" placeholder="Student ID (optional)" value={userForm.studentId} onChange={(e) => setUserForm((p) => ({ ...p, studentId: e.target.value }))} />}
                    <button type="submit" className="modern-btn">Create Account</button>
                  </form>
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <Users size={18} color="#eab308" />
                    <h3>Directory Setup</h3>
                  </div>
                  <div className="admin-recent-list" style={{ height: '100%', maxHeight: '420px' }}>
                    {filteredUsers.map((u) => (
                      <div key={u.id} className="admin-recent-item">
                        <div className="admin-recent-item-info">
                          <span className="admin-recent-item-title">{u.displayName || 'No Name'}</span>
                          <span className="admin-recent-item-sub">{u.email}</span>
                        </div>
                        <span className="admin-badge badge-green">{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'tokens' && (
            <section>
              <div className="admin-section-header-modern">
                <h2>Token Management</h2>
                <p>Manage digital wallets and review wallet history.</p>
              </div>
              <div className="admin-grid-layout">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <Wallet size={18} color="#3b82f6" />
                    <h3>Manual Top-up</h3>
                  </div>
                  <form className="modern-form-grid" onSubmit={handleTokenTopup}>
                    <select className="modern-select" value={tokenForm.studentUid} onChange={(e) => setTokenForm((p) => ({ ...p, studentUid: e.target.value }))} required>
                      <option value="">Select student account</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {getStudentLabel(s.id)}
                        </option>
                      ))}
                    </select>
                    <input className="modern-input" type="number" placeholder="Amount (Rs.)" value={tokenForm.amount} min="1" onChange={(e) => setTokenForm((p) => ({ ...p, amount: e.target.value }))} required />
                    {tokenForm.studentUid && <div style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600 }}>Current balance: Rs. {walletMap[tokenForm.studentUid]?.balance || 0}</div>}
                    <button type="submit" className="modern-btn" disabled={topupSubmitting}>
                      {topupSubmitting ? 'Processing...' : 'Confirm Top-up'}
                    </button>
                  </form>
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <History size={18} color="#06b6d4" />
                    <h3>Transactions: {tokenForm.studentUid ? getStudentLabel(tokenForm.studentUid) : 'Select a student'}</h3>
                  </div>
                  {tokenForm.studentUid && (
                    <div className="modern-table-container">
                      <table className="modern-table">
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
                            <tr><td colSpan={3} className="modern-empty-cell">No history.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-panel" style={{ marginTop: '1.5rem' }}>
                <div className="admin-panel-header">
                  <Ticket size={18} color="#10b981" />
                  <h3>Student Token Profiles (1 profile per student)</h3>
                </div>
                <div className="modern-table-container">
                  <table className="modern-table">
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
                        <tr><td colSpan={4} className="modern-empty-cell">No profiles found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'trips' && (
            <section>
              <div className="admin-section-header-modern">
                <h2>Trip Settings</h2>
                <p>Configure dynamic shuttle pricing profiles.</p>
              </div>
              <div className="admin-grid-layout">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <Save size={18} color="#3b82f6" />
                    <h3>Global Default Rule</h3>
                  </div>
                  <form style={{ display: 'flex', gap: '1rem' }} onSubmit={handleSaveGlobalPrice}>
                    <input className="modern-input" style={{ marginBottom: 0 }} type="number" min="1" value={globalPriceInput} onChange={(e) => setGlobalPriceInput(e.target.value)} />
                    <button type="submit" className="modern-btn">Save</button>
                  </form>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1rem' }}>Current global default: Rs. {globalPricePerKm}/km</p>
                </div>

                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <UserCog size={18} color="#06b6d4" />
                    <h3>Driver-Specific Custom Pricing</h3>
                  </div>
                  <div className="admin-recent-list">
                    {drivers.map((driver) => (
                      <div key={driver.id} className="admin-recent-item" style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <div className="admin-recent-item-info">
                          <span className="admin-recent-item-title">{driver.displayName || driver.email}</span>
                          <span className="admin-recent-item-sub">{driver.email}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '200px' }}>
                          <input className="modern-input" style={{ marginBottom: 0, width: '100%' }} type="number" min="1" placeholder={String(driver.driverPricing?.defaultPricePerKm || globalPricePerKm)} value={driverPrices[driver.id] ?? ''} onChange={(e) => setDriverPrices((p) => ({ ...p, [driver.id]: e.target.value }))} />
                          <button className="modern-btn modern-btn-outline" onClick={() => handleSaveDriverPrice(driver.id)}>Set</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'history' && (
            <section>
              <div className="admin-section-header-modern">
                <h2>Trip & Payment History</h2>
                <p>Audit and verify full interaction logs.</p>
              </div>
              <div className="admin-panel">
                <div className="modern-filter-row">
                  <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Filter size={16} /> Filters</div>
                  <select className="modern-select" style={{ marginBottom: 0 }} value={historyFilter.type} onChange={(e) => setHistoryFilter((p) => ({ ...p, type: e.target.value }))}>
                    <option value="all">All types</option><option value="fare-deduction">Fare deduction</option><option value="top-up">Top-up</option>
                  </select>
                  <select className="modern-select" style={{ marginBottom: 0 }} value={historyFilter.direction} onChange={(e) => setHistoryFilter((p) => ({ ...p, direction: e.target.value }))}>
                    <option value="all">All directions</option><option value="home-to-campus">Home to Campus</option><option value="campus-to-home">Campus to Home</option>
                  </select>
                  <select className="modern-select" style={{ marginBottom: 0 }} value={historyFilter.studentUid} onChange={(e) => setHistoryFilter((p) => ({ ...p, studentUid: e.target.value }))}>
                    <option value="">All students</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.email}</option>)}
                  </select>
                </div>
                <div className="modern-table-container mt-4">
                  <table className="modern-table">
                    <thead><tr><th>Student</th><th>Driver</th><th>Type</th><th>Direction</th><th>Amount</th><th>Date</th></tr></thead>
                    <tbody>
                      {filteredHistory.slice(0, 80).map((p) => (
                        <tr key={p.id}>
                          <td>{p.studentName || getStudentLabel(p.studentUid)}</td>
                          <td>{p.driverUid || '-'}</td>
                          <td><span className="admin-badge badge-blue">{p.type}</span></td>
                          <td>{p.direction || '-'}</td>
                          <td className={p.amount < 0 ? 'neg' : 'pos'}>Rs. {Math.abs(p.amount || 0)}</td>
                          <td>{p.dateKey || dateKey(p.timestamp)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'analytics' && (
            <section>
              <div className="admin-section-header-modern">
                <h2>Business Analytics</h2>
                <p>System capacity charts and deep insights.</p>
              </div>
              <div className="admin-grid-layout">
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <BarChart3 size={18} color="#3b82f6" />
                    <h3>Daily Revenue Pattern</h3>
                  </div>
                  <SimpleBars data={chartData} />
                </div>
                <div className="admin-panel">
                  <div className="admin-panel-header">
                    <Users size={18} color="#10b981" />
                    <h3>Capacity Insights</h3>
                  </div>
                  <div className="admin-recent-list">
                    <div className="admin-recent-item"><span className="admin-recent-item-title">Students</span><span className="admin-badge badge-blue">{students.length}</span></div>
                    <div className="admin-recent-item"><span className="admin-recent-item-title">Drivers</span><span className="admin-badge badge-blue">{drivers.length}</span></div>
                    <div className="admin-recent-item"><span className="admin-recent-item-title">Admins</span><span className="admin-badge badge-blue">{admins.length}</span></div>
                    <div className="admin-recent-item"><span className="admin-recent-item-title">Avg. revenue / trip</span><span className="admin-badge badge-green">Rs. {payments.length ? Math.round(totalRevenue / payments.length) : 0}</span></div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'governance' && (
            <section>
              <div className="admin-section-header-modern">
                <h2>Governance & Security</h2>
                <p>Operational health controls and roles.</p>
              </div>
              <div className="admin-panel">
                <table className="modern-table">
                  <tbody>
                    <tr><td><strong>Role-based policy</strong></td><td><span className="admin-badge badge-green">Enabled</span></td></tr>
                    <tr><td><strong>Pricing governance</strong></td><td><span className="admin-badge badge-blue">Driver + Global</span></td></tr>
                    <tr><td><strong>Duplicate scan control</strong></td><td><span className="admin-badge badge-green">Enabled</span></td></tr>
                    <tr><td><strong>Next recommended</strong></td><td><span className="admin-badge badge-red">Audit log export</span></td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
