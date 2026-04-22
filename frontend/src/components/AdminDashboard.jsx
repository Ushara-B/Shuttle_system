import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { Users, UserPlus, CreditCard, LogOut, Search } from 'lucide-react';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('student');
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(false);

    // Listen to users based on active tab
    useEffect(() => {
        const q = query(collection(db, 'users'), where('role', '==', activeTab));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = [];
            snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
            setUsers(docs);
        });
        return () => unsubscribe();
    }, [activeTab]);

    const handleTopUp = async (studentUid) => {
        const amount = prompt("Enter top-up amount (Rs.):");
        if (!amount || isNaN(amount)) return;

        try {
            const response = await fetch('http://localhost:5000/api/admin/adjust-balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({ studentUid, amount: Number(amount) }),
            });
            if (response.ok) alert('Top-up successful!');
            else alert('Failed to top up');
        } catch (err) {
            alert('Connection error');
        }
    };

    return (
        <div className="dashboard-container">
            <nav className="side-nav">
                <div className="nav-brand">Admin Panel</div>
                <div className="nav-items">
                    <button className={activeTab === 'student' ? 'active' : ''} onClick={() => setActiveTab('student')}>
                        <Users size={20} /> Students
                    </button>
                    <button className={activeTab === 'driver' ? 'active' : ''} onClick={() => setActiveTab('driver')}>
                        <Users size={20} /> Drivers
                    </button>
                    <button className={activeTab === 'admin' ? 'active' : ''} onClick={() => setActiveTab('admin')}>
                        <Users size={20} /> Admins
                    </button>
                </div>
                <button className="logout-btn" onClick={() => auth.signOut()}>
                    <LogOut size={20} /> Logout
                </button>
            </nav>

            <main className="dashboard-main">
                <header className="dashboard-header">
                    <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Management</h1>
                    <button className="primary-btn" onClick={() => setShowAddModal(true)}>
                        <UserPlus size={20} /> Add New {activeTab}
                    </button>
                </header>

                <div className="search-bar">
                    <Search size={20} />
                    <input
                        type="text"
                        placeholder={`Search ${activeTab}s...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="user-grid">
                    {users.filter(u => u.email.includes(search)).map(user => (
                        <div key={user.id} className="user-card">
                            <div className="user-info">
                                <h3>{user.displayName || 'No Name'}</h3>
                                <p>{user.email}</p>
                                {activeTab === 'student' && <p className="std-id">ID: {user.studentId || 'N/A'}</p>}
                            </div>
                            <div className="user-actions">
                                {activeTab === 'student' && (
                                    <button className="action-btn" onClick={() => handleTopUp(user.id)}>
                                        <CreditCard size={18} /> Top-up
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {showAddModal && <AddUserModal role={activeTab} onClose={() => setShowAddModal(false)} />}
        </div>
    );
};

const AddUserModal = ({ role, onClose }) => {
    const [formData, setFormData] = useState({ email: '', password: '', displayName: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://localhost:5000/api/admin/create-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({ ...formData, role }),
            });
            if (response.ok) {
                alert('User created!');
                onClose();
            } else {
                const data = await response.json();
                alert(data.error);
            }
        } catch (err) {
            alert('Error creating user');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-card">
                <h2>Add New {role}</h2>
                <form onSubmit={handleSubmit}>
                    <input type="text" placeholder="Display Name" onChange={e => setFormData({ ...formData, displayName: e.target.value })} required />
                    <input type="email" placeholder="Email" onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                    <input type="password" placeholder="Password" onChange={e => setFormData({ ...formData, password: e.target.value })} required />
                    <div className="modal-btns">
                        <button type="button" onClick={onClose}>Cancel</button>
                        <button type="submit" className="primary-btn">Create User</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminDashboard;
