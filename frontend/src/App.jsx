import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DriverDashboard from './components/DriverDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auth gate for the web dashboard:
    // - listen to Firebase Auth state
    // - read custom claim `role` to decide which dashboard to show
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Fetch custom claims for role
        const idTokenResult = await user.getIdTokenResult();
        setRole(idTokenResult.claims.role || 'student');
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Router>
      <Routes>
        {/* Login route:
            - if logged out => show login form
            - if logged in => route to admin/driver based on role */}
        <Route path="/" element={!user ? <Login /> : <Navigate to={role === 'admin' ? '/admin' : '/driver'} />} />

        <Route
          path="/admin"
          // Guard admin routes explicitly (prevents direct URL access by drivers).
          element={user && role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />}
        />

        <Route
          path="/driver"
          // Guard driver routes explicitly (prevents direct URL access by admins/students).
          element={user && role === 'driver' ? <DriverDashboard /> : <Navigate to="/" />}
        />

        {/* Catch-all: keep routing simple for this app */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
