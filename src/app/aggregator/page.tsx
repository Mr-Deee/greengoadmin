'use client';

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import styles from './aggregator.module.css';

interface CollectionData {
  id: string;
  date: string;
  weight: number;
  category: string;
  location: string;
  status: string;
  fieldOperator: string;
  fieldOperatorId?: string;
  clientName?: string;
  clientId?: string;
  timestamp?: number;
}

interface WasteRequest {
  id: string;
  client_name?: string;
  category?: string;
  status?: string;
  weight?: string;
  weight_kg?: number;
  created_at?: string;
  WMS_name?: string;
  location?: string;
}

export default function AggregatorPage() {
  const [collections, setCollections] = useState<CollectionData[]>([]);
  const [wasteRequests, setWasteRequests] = useState<WasteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCollected: 0,
    pendingCollections: 0,
    activeOperators: 0,
    averageDailyCollection: 0,
    totalRevenue: 0,
    completedToday: 0
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    fetchCollectionsRealtime();
    fetchWasteRequestsRealtime();
  }, []);

  // Real-time listener for collections
  const fetchCollectionsRealtime = () => {
    const collectionsRef = ref(db, 'collectionLogs');
    
    const unsubscribe = onValue(collectionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const collectionsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as CollectionData[];
        
        // Sort by date descending
        collectionsArray.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        setCollections(collectionsArray.slice(0, 50));
        
        // Calculate stats
        const today = new Date().toISOString().split('T')[0];
        const completedToday = collectionsArray.filter(c => 
          c.status === 'completed' && c.date?.startsWith(today)
        ).length;
        
        const totalWeight = collectionsArray.reduce((sum, c) => sum + (c.weight || 0), 0);
        const pendingCount = collectionsArray.filter(c => c.status === 'pending' || c.status === 'in-progress').length;
        
        setStats(prev => ({
          ...prev,
          totalCollected: totalWeight,
          pendingCollections: pendingCount,
          completedToday: completedToday,
          averageDailyCollection: totalWeight / 30,
        }));
      } else {
        setCollections([]);
        setStats(prev => ({
          ...prev,
          totalCollected: 0,
          pendingCollections: 0,
          completedToday: 0,
          averageDailyCollection: 0,
        }));
      }
    }, (error) => {
      console.error('Error fetching collections:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  };

  // Real-time listener for waste requests
  const fetchWasteRequestsRealtime = () => {
    const requestsRef = ref(db, 'ClientRequest');
    
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const requestsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as WasteRequest[];
        
        setWasteRequests(requestsArray);
        
        // Calculate revenue from completed requests
        const completedRequests = requestsArray.filter(r => r.status === 'ended');
        const totalRevenue = completedRequests.reduce((sum, r) => sum + (Number(r.weight_kg) * 2 || 0), 0);
        
        setStats(prev => ({
          ...prev,
          totalRevenue: totalRevenue,
          activeOperators: Math.ceil(prev.totalCollected / 500) || 5, // Estimate based on collection volume
        }));
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching waste requests:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  };

  const getStatsForPeriod = () => {
    const now = new Date();
    let filteredCollections = [...collections];
    
    if (selectedPeriod === 'daily') {
      const today = now.toISOString().split('T')[0];
      filteredCollections = collections.filter(c => c.date?.startsWith(today));
    } else if (selectedPeriod === 'weekly') {
      const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
      filteredCollections = collections.filter(c => c.date >= weekAgo);
    } else if (selectedPeriod === 'monthly') {
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      filteredCollections = collections.filter(c => c.date >= monthAgo);
    }
    
    const totalWeight = filteredCollections.reduce((sum, c) => sum + (c.weight || 0), 0);
    const completedCount = filteredCollections.filter(c => c.status === 'completed').length;
    
    return { totalWeight, completedCount };
  };

  const periodStats = getStatsForPeriod();

  if (loading) {
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
          <h1>🏢 Aggregator Dashboard</h1>
          <p>Manage waste collection across your district</p>
        </div>
        <div className={styles.dateInfo}>
          {new Date().toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📦</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.totalCollected.toLocaleString()} kg</div>
            <div className={styles.statLabel}>Total Waste Collected</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>⏳</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.pendingCollections}</div>
            <div className={styles.statLabel}>Pending Collections</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>👷</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.activeOperators}</div>
            <div className={styles.statLabel}>Active Field Operators</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>₵{stats.totalRevenue.toLocaleString()}</div>
            <div className={styles.statLabel}>Total Revenue</div>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className={styles.periodSection}>
        <h2>Collection Overview</h2>
        <div className={styles.periodSelector}>
          <button 
            className={selectedPeriod === 'daily' ? styles.active : ''}
            onClick={() => setSelectedPeriod('daily')}
          >
            📅 Daily
          </button>
          <button 
            className={selectedPeriod === 'weekly' ? styles.active : ''}
            onClick={() => setSelectedPeriod('weekly')}
          >
            📊 Weekly
          </button>
          <button 
            className={selectedPeriod === 'monthly' ? styles.active : ''}
            onClick={() => setSelectedPeriod('monthly')}
          >
            📈 Monthly
          </button>
        </div>
        
        <div className={styles.periodStats}>
          <div className={styles.periodStatCard}>
            <div className={styles.periodStatValue}>{periodStats.totalWeight.toLocaleString()} kg</div>
            <div className={styles.periodStatLabel}>Total Collected</div>
          </div>
          <div className={styles.periodStatCard}>
            <div className={styles.periodStatValue}>{periodStats.completedCount}</div>
            <div className={styles.periodStatLabel}>Completed Collections</div>
          </div>
          <div className={styles.periodStatCard}>
            <div className={styles.periodStatValue}>
              {(periodStats.totalWeight / (periodStats.completedCount || 1)).toFixed(1)} kg
            </div>
            <div className={styles.periodStatLabel}>Average per Collection</div>
          </div>
        </div>
      </div>

      {/* Collection Table */}
      <div className={styles.tableContainer}>
        <h2>Recent Collections</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Field Operator</th>
                <th>Client</th>
                <th>Location</th>
                <th>Category</th>
                <th>Weight (kg)</th>
                <th>Status</th>
               </tr>
            </thead>
            <tbody>
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyTable}>
                    No collection records found
                  </td>
                </tr>
              ) : (
                collections.map((collection) => (
                  <tr key={collection.id}>
                    <td>{new Date(collection.date).toLocaleDateString()}</td>
                    <td>{collection.fieldOperator || 'N/A'}</td>
                    <td>{collection.clientName || 'N/A'}</td>
                    <td>{collection.location?.split(',')[0] || 'N/A'}</td>
                    <td>
                      <span className={styles.categoryBadge}>
                        {collection.category || 'General'}
                      </span>
                    </td>
                    <td>{collection.weight || 0}</td>
                    <td>
                      <span className={`${styles.status} ${styles[collection.status]}`}>
                        {collection.status === 'completed' ? '✅ Completed' : 
                         collection.status === 'in-progress' ? '🚚 In Progress' : 
                         collection.status === 'pending' ? '⏳ Pending' : collection.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Material Flow Visualization */}
      <div className={styles.flowSection}>
        <h2>Material Flow Tracking</h2>
        <div className={styles.flowChart}>
          <div className={styles.flowNode}>
            <div className={styles.nodeIcon}>🏠</div>
            <div className={styles.nodeTitle}>Generators</div>
            <div className={styles.nodeValue}>{wasteRequests.length}</div>
            <div className={styles.nodeSubtext}>Active</div>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowNode}>
            <div className={styles.nodeIcon}>👷</div>
            <div className={styles.nodeTitle}>Field Operators</div>
            <div className={styles.nodeValue}>{stats.activeOperators}</div>
            <div className={styles.nodeSubtext}>Active</div>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowNode}>
            <div className={styles.nodeIcon}>🏢</div>
            <div className={styles.nodeTitle}>Aggregators</div>
            <div className={styles.nodeValue}>1</div>
            <div className={styles.nodeSubtext}>You</div>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowNode}>
            <div className={styles.nodeIcon}>♻️</div>
            <div className={styles.nodeTitle}>Recyclers</div>
            <div className={styles.nodeValue}>
              {wasteRequests.filter(r => r.status === 'ended').length}
            </div>
            <div className={styles.nodeSubtext}>Completed</div>
          </div>
        </div>
      </div>

      {/* Waste Category Distribution */}
      <div className={styles.categorySection}>
        <h2>Waste by Category</h2>
        <div className={styles.categoryGrid}>
          {['Plastic', 'Glass', 'Organic', 'Metal', 'Paper', 'General'].map(category => {
            const categoryWeight = collections
              .filter(c => c.category === category)
              .reduce((sum, c) => sum + (c.weight || 0), 0);
            const percentage = stats.totalCollected > 0 
              ? (categoryWeight / stats.totalCollected) * 100 
              : 0;
            
            return (
              <div key={category} className={styles.categoryCard}>
                <div className={styles.categoryIcon}>
                  {category === 'Plastic' && '🥤'}
                  {category === 'Glass' && '🍾'}
                  {category === 'Organic' && '🍎'}
                  {category === 'Metal' && '🔩'}
                  {category === 'Paper' && '📄'}
                  {category === 'General' && '🗑️'}
                </div>
                <div className={styles.categoryName}>{category}</div>
                <div className={styles.categoryWeight}>{categoryWeight.toLocaleString()} kg</div>
                <div className={styles.categoryBar}>
                  <div 
                    className={styles.categoryBarFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className={styles.categoryPercentage}>{percentage.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}