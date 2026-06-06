'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import './globals.css';

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

// Role-specific navigation items
const roleNavItems: Record<string, NavItem[]> = {
  super_admin: [
    { name: 'Dashboard', href: '/super-admin', icon: '📊' },
    { name: 'User Management', href: '/super-admin/users', icon: '👥' },
    { name: 'All Recyclers', href: '/super-admin/recyclers', icon: '♻️' },
    { name: 'Reports', href: '/super-admin/reports', icon: '📈' },
    { name: 'Analytics', href: '/super-admin/analytics', icon: '📉' },
    { name: 'Settings', href: '/super-admin/settings', icon: '⚙️' },
  ],
  aggregator: [
    { name: 'Dashboard', href: '/aggregator', icon: '📊' },
    { name: 'Waste Collection', href: '/aggregator/collection', icon: '🗑️' },
    { name: 'Field Operators', href: '/aggregator/operators', icon: '👷' },
    { name: 'Reports', href: '/aggregator/reports', icon: '📈' },
    { name: 'Transactions', href: '/aggregator/transactions', icon: '💰' },
  ],
  field_operator: [
    { name: 'Dashboard', href: '/field-operator', icon: '📊' },
    { name: 'Collection Tasks', href: '/field-operator/tasks', icon: '📋' },
    { name: 'Route Map', href: '/field-operator/map', icon: '🗺️' },
    { name: 'Collection Logs', href: '/field-operator/logs', icon: '📝' },
    { name: 'Service Requests', href: '/field-operator/requests', icon: '🆘' },
  ],
  recycler: [
    { name: 'Dashboard', href: '/recycler', icon: '📊' },
    { name: 'Receive Waste', href: '/recycler/receive', icon: '📦' },
    { name: 'Processing', href: '/recycler/processing', icon: '🏭' },
    { name: 'Inventory', href: '/recycler/inventory', icon: '📦' },
    { name: 'Sales', href: '/recycler/sales', icon: '💰' },
  ],
  business: [
    { name: 'Dashboard', href: '/business', icon: '📊' },
    { name: 'Purchase Recyclables', href: '/business/purchase', icon: '🛒' },
    { name: 'Price Trends', href: '/business/prices', icon: '📈' },
    { name: 'Orders', href: '/business/orders', icon: '📋' },
    { name: 'Reports', href: '/business/reports', icon: '📊' },
  ],
  government: [
    { name: 'Dashboard', href: '/government', icon: '📊' },
    { name: 'Compliance', href: '/government/compliance', icon: '✅' },
    { name: 'Performance', href: '/government/performance', icon: '📈' },
    { name: 'Impact Reports', href: '/government/impact', icon: '🌍' },
    { name: 'Policy', href: '/government/policy', icon: '📜' },
  ],
  ngo: [
    { name: 'Dashboard', href: '/ngo', icon: '📊' },
    { name: 'Community Programs', href: '/ngo/programs', icon: '🤝' },
    { name: 'Impact Metrics', href: '/ngo/impact', icon: '🌱' },
    { name: 'Reports', href: '/ngo/reports', icon: '📈' },
  ],
  sustainability_team: [
    { name: 'Dashboard', href: '/sustainability', icon: '📊' },
    { name: 'Environmental Metrics', href: '/sustainability/metrics', icon: '🌍' },
    { name: 'Carbon Footprint', href: '/sustainability/carbon', icon: '🏭' },
    { name: 'SDG Reports', href: '/sustainability/sdg', icon: '🎯' },
    { name: 'Recommendations', href: '/sustainability/recommendations', icon: '💡' },
  ],
  regulator: [
    { name: 'Dashboard', href: '/regulator', icon: '📊' },
    { name: 'Compliance Checks', href: '/regulator/compliance', icon: '🔍' },
    { name: 'Licensing', href: '/regulator/licensing', icon: '📜' },
    { name: 'Violations', href: '/regulator/violations', icon: '⚠️' },
    { name: 'Reports', href: '/regulator/reports', icon: '📈' },
  ],
  civil_society: [
    { name: 'Dashboard', href: '/civil-society', icon: '📊' },
    { name: 'Community Feedback', href: '/civil-society/feedback', icon: '💬' },
    { name: 'Transparency Reports', href: '/civil-society/transparency', icon: '👁️' },
    { name: 'Advocacy', href: '/civil-society/advocacy', icon: '📢' },
  ],
  policy_maker: [
    { name: 'Dashboard', href: '/policy-maker', icon: '📊' },
    { name: 'Strategic Planning', href: '/policy-maker/planning', icon: '🎯' },
    { name: 'Forecasting', href: '/policy-maker/forecast', icon: '🔮' },
    { name: 'Infrastructure', href: '/policy-maker/infrastructure', icon: '🏗️' },
    { name: 'Policy Recommendations', href: '/policy-maker/recommendations', icon: '📋' },
  ],
  investor: [
    { name: 'Dashboard', href: '/investor', icon: '📊' },
    { name: 'Market Analysis', href: '/investor/market', icon: '📈' },
    { name: 'Investment Opportunities', href: '/investor/opportunities', icon: '💼' },
    { name: 'Financial Reports', href: '/investor/financial', icon: '💰' },
    { name: 'ROI Calculator', href: '/investor/roi', icon: '🧮' },
  ],
  platform_leadership: [
    { name: 'Dashboard', href: '/platform-leadership', icon: '📊' },
    { name: 'Platform Metrics', href: '/platform-leadership/metrics', icon: '📈' },
    { name: 'User Growth', href: '/platform-leadership/growth', icon: '📈' },
    { name: 'Strategic Decisions', href: '/platform-leadership/strategic', icon: '🎯' },
    { name: 'Executive Reports', href: '/platform-leadership/reports', icon: '📊' },
  ],
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUserEmail(user.email || '');

      try {
        // Get user role from Realtime Database
        const userRef = ref(db, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        if (userData) {
          setUserRole(userData.role);
          setUserName(userData.name || user.email?.split('@')[0] || 'User');
        } else {
          // If user not found in users node, check Admin node for super_admin
          const adminRef = ref(db, `Admin/${user.uid}`);
          const adminSnapshot = await get(adminRef);
          const adminData = adminSnapshot.val();
          
          if (adminData && adminData.role === 'super_admin') {
            setUserRole('super_admin');
            setUserName(adminData.name || user.email?.split('@')[0] || 'Admin');
          } else {
            console.error('User role not found');
            router.push('/unauthorized');
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const navItems = userRole ? roleNavItems[userRole] || [] : [];

  // Don't render sidebar while loading
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">♻️</span>
            {sidebarOpen && <span className="logo-text">GreenGo-Hub</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-text">{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>
            {sidebarOpen && (
              <div className="user-details">
                <span className="user-name">{userName}</span>
                <span className="user-email">{userEmail}</span>
                <span className="user-role">{userRole?.replace('_', ' ').replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <span className="nav-icon">🚪</span>
            {sidebarOpen && <span className="nav-text">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          {children}
        </div>
      </main>

      <style jsx>{`
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        
        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .loading-container p {
          color: white;
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}