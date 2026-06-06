'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { ref, get, onValue } from 'firebase/database';
import styles from './superadmin.module.css';

export default function SuperAdminPage() {
  const { user, loading } = useAuth('super_admin');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeRecyclers: 0,
    totalWasteKg: 0,
    totalRevenue: 0,
    pendingRequests: 0,
    completedRequests: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      fetchAllStats();
    }
  }, [loading, user]);

  const fetchAllStats = async () => {
    setStatsLoading(true);
    
    try {
      // Fetch counts from different database nodes
      
      // 1. Total Users (from Clients node)
      const clientsRef = ref(db, 'Clients');
      const clientsSnapshot = await get(clientsRef);
      const totalClients = clientsSnapshot.exists() ? Object.keys(clientsSnapshot.val()).length : 0;
      
      // 2. Active Recyclers (from Recyclers node where detailsComp is true)
      const recyclersRef = ref(db, 'Recyclers');
      const recyclersSnapshot = await get(recyclersRef);
      let activeRecyclers = 0;
      let totalRecyclers = 0;
      if (recyclersSnapshot.exists()) {
        const recyclers = recyclersSnapshot.val();
        totalRecyclers = Object.keys(recyclers).length;
        activeRecyclers = Object.values(recyclers).filter((r: any) => r.detailsComp === true).length;
      }
      
      // 3. Total Waste Collected and Revenue from ClientRequest node (ended status)
      const requestsRef = ref(db, 'ClientRequest');
      const requestsSnapshot = await get(requestsRef);
      let totalWasteKg = 0;
      let totalRevenue = 0;
      let completedRequests = 0;
      let pendingRequests = 0;
      
      if (requestsSnapshot.exists()) {
        const requests = requestsSnapshot.val();
        Object.values(requests).forEach((request: any) => {
          if (request.status === 'ended') {
            completedRequests++;
            // Add weight if available
            if (request.weight_kg) {
              totalWasteKg += Number(request.weight_kg);
            } else if (request.weight && !isNaN(Number(request.weight))) {
              totalWasteKg += Number(request.weight);
            }
            // Add revenue if calculated_price exists
            if (request.calculated_price) {
              totalRevenue += Number(request.calculated_price);
            }
          } else if (request.status === 'searching' || request.status === 'accepted' || request.status === 'onride' || request.status === 'arrived') {
            pendingRequests++;
          }
        });
      }
      
      // 4. Also include Admin users (if any)
      const adminRef = ref(db, 'Admin');
      const adminSnapshot = await get(adminRef);
      const totalAdmins = adminSnapshot.exists() ? Object.keys(adminSnapshot.val()).length : 0;
      
      setStats({
        totalUsers: totalClients + totalRecyclers + totalAdmins,
        activeRecyclers: activeRecyclers,
        totalWasteKg: Math.round(totalWasteKg * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        pendingRequests: pendingRequests,
        completedRequests: completedRequests
      });
      
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Set up real-time listeners for live updates
  useEffect(() => {
    if (!loading && user) {
      // Listen for real-time updates to ClientRequest
      const requestsRef = ref(db, 'ClientRequest');
      const unsubscribeRequests = onValue(requestsRef, async () => {
        await fetchAllStats();
      });
      
      // Listen for real-time updates to Recyclers
      const recyclersRef = ref(db, 'Recyclers');
      const unsubscribeRecyclers = onValue(recyclersRef, async () => {
        await fetchAllStats();
      });
      
      // Listen for real-time updates to Clients
      const clientsRef = ref(db, 'Clients');
      const unsubscribeClients = onValue(clientsRef, async () => {
        await fetchAllStats();
      });
      
      return () => {
        unsubscribeRequests();
        unsubscribeRecyclers();
        unsubscribeClients();
      };
    }
  }, [loading, user]);
  
  const menuItems = [
    { title: 'User Management', icon: '👥', href: '/superadmin/users', description: 'Create and manage all platform users', color: '#667eea' },
    { title: 'Recyclers', icon: '♻️', href: '/superadmin/recyclers', description: 'Manage recycler accounts and approvals', color: '#4CAF50' },
    { title: 'Reports', icon: '📊', href: '/superadmin/reports', description: 'View system reports and analytics', color: '#FF9800' },
    { title: 'Analytics', icon: '📈', href: '/superadmin/analytics', description: 'Platform performance metrics', color: '#2196F3' },
    { title: 'Settings', icon: '⚙️', href: '/superadmin/settings', description: 'System configuration', color: '#9C27B0' },
  ];
  
  if (loading || statsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Welcome, {user?.name || 'Super Admin'}!</h1>
          <p>Super Admin Dashboard - Manage GreenGo-Hub Platform</p>
        </div>
        <div className={styles.dateBadge}>
          {new Date().toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>
      
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalUsers.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Users</div>
            <div className={styles.statSubLabel}>Clients + Recyclers + Admins</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>♻️</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.activeRecyclers.toLocaleString()}</div>
            <div className={styles.statLabel}>Active Recyclers</div>
            <div className={styles.statSubLabel}>Verified waste collectors</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalWasteKg.toLocaleString()} kg</div>
            <div className={styles.statLabel}>Waste Collected</div>
            <div className={styles.statSubLabel}>Total from completed requests</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>₵{stats.totalRevenue.toLocaleString()}</div>
            <div className={styles.statLabel}>Revenue</div>
            <div className={styles.statSubLabel}>From completed collections</div>
          </div>
        </div>
      </div>
      
      {/* Additional Stats Row */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏳</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.pendingRequests.toLocaleString()}</div>
            <div className={styles.statLabel}>Pending Requests</div>
            <div className={styles.statSubLabel}>Awaiting processing</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>✅</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.completedRequests.toLocaleString()}</div>
            <div className={styles.statLabel}>Completed Requests</div>
            <div className={styles.statSubLabel}>Successfully processed</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>
              {stats.completedRequests > 0 
                ? Math.round((stats.completedRequests / (stats.completedRequests + stats.pendingRequests)) * 100) 
                : 0}%
            </div>
            <div className={styles.statLabel}>Completion Rate</div>
            <div className={styles.statSubLabel}>Success rate</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💚</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>
              {stats.totalWasteKg > 0 
                ? Math.round(stats.totalWasteKg * 0.5) 
                : 0} kg
            </div>
            <div className={styles.statLabel}>CO₂ Reduction</div>
            <div className={styles.statSubLabel}>Estimated carbon offset</div>
          </div>
        </div>
      </div>
      
      <div className={styles.menuGrid}>
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href} className={styles.menuCard}>
            <div className={styles.menuIcon} style={{ backgroundColor: item.color }}>
              {item.icon}
            </div>
            <div className={styles.menuContent}>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
            <div className={styles.menuArrow}>→</div>
          </Link>
        ))}
      </div>
      
      {/* Quick Insight Section */}
      <div className={styles.insightSection}>
        <h2>Quick Insights</h2>
        <div className={styles.insightGrid}>
          <div className={styles.insightCard}>
            <h4>📈 Top Category</h4>
            <p>Plastic waste is the most collected category</p>
          </div>
          <div className={styles.insightCard}>
            <h4>🏆 Best District</h4>
            <p>Ablekuma North Municipal District</p>
          </div>
          <div className={styles.insightCard}>
            <h4>🔄 Recycling Rate</h4>
            <p>~{stats.completedRequests > 0 ? Math.round((stats.completedRequests / (stats.completedRequests + stats.pendingRequests)) * 100) : 0}% successful collections</p>
          </div>
          <div className={styles.insightCard}>
            <h4>🌱 Environmental Impact</h4>
            <p>{stats.totalWasteKg > 0 ? Math.round(stats.totalWasteKg * 0.5) : 0} kg CO₂ saved</p>
          </div>
        </div>
      </div>
    </div>
  );
}