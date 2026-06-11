'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, get } from 'firebase/database';
import { useRouter } from 'next/navigation';
import styles from './sustainability.module.css';

interface WasteRequest {
  id: string;
  client_name?: string;
  category?: string;
  waste_category?: string;
  waste_grade?: string;
  status?: string;
  weight?: string;
  weight_kg?: number;
  calculated_price?: number;
  created_at?: string;
  location?: string;
  WMS_name?: string;
}

interface SustainabilityMetrics {
  wasteDivertedLandfill: number;
  recyclingRates: Record<string, number>;
  carbonEmissionReduction: number;
  plasticRecycled: number;
  wasteRecoveryRate: number;
  co2EquivalentAvoided: number;
  waterSaved: number;
  energySaved: number;
  treesSaved: number;
}

interface MonthlyTrend {
  month: string;
  weight: number;
  co2Saved: number;
  plasticRecycled: number;
}

export default function SustainabilityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [wasteRequests, setWasteRequests] = useState<WasteRequest[]>([]);
  const [metrics, setMetrics] = useState<SustainabilityMetrics>({
    wasteDivertedLandfill: 0,
    recyclingRates: {},
    carbonEmissionReduction: 0,
    plasticRecycled: 0,
    wasteRecoveryRate: 0,
    co2EquivalentAvoided: 0,
    waterSaved: 0,
    energySaved: 0,
    treesSaved: 0
  });
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        // Check in Admin node first
        const adminRef = ref(db, `Admin/${user.uid}`);
        const adminSnapshot = await get(adminRef);
        const adminData = adminSnapshot.val();
        
        let role = adminData?.role;
        let name = adminData?.name || user.email?.split('@')[0] || 'User';
        
        // If not admin, check in Sustainability node
        if (!role) {
          const sustainabilityRef = ref(db, `Sustainability/${user.uid}`);
          const sustainabilitySnapshot = await get(sustainabilityRef);
          const sustainabilityData = sustainabilitySnapshot.val();
          
          if (sustainabilityData) {
            role = sustainabilityData.role || 'sustainability_team';
            name = sustainabilityData.name || sustainabilityData.firstName || user.email?.split('@')[0] || 'Sustainability Team';
          }
        }
        
        // Check if user has access to sustainability dashboard
        const allowedRoles = ['sustainability_team', 'super_admin', 'government', 'ngo'];
        if (!role || !allowedRoles.includes(role)) {
          router.push('/unauthorized');
          return;
        }
        
        setUserName(name);
        loadWasteData();
        
      } catch (error) {
        console.error('Error checking auth:', error);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  };

  const loadWasteData = () => {
    const requestsRef = ref(db, 'ClientRequest');
    
    const unsubscribe = onValue(requestsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const requestsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as WasteRequest[];
        
        // Only include completed requests (ended status)
        const completedRequests = requestsArray.filter(req => req.status === 'ended');
        setWasteRequests(completedRequests);
        
        calculateMetrics(completedRequests);
        calculateMonthlyTrends(completedRequests);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  };

  const calculateMetrics = (requests: WasteRequest[]) => {
    // Calculate total waste collected
    const totalWaste = requests.reduce((sum, req) => sum + (req.weight_kg || 0), 0);
    
    // Calculate waste by category
    const wasteByCategory: Record<string, number> = {};
    requests.forEach(req => {
      const category = req.waste_category || req.category || 'General';
      const weight = req.weight_kg || 0;
      wasteByCategory[category] = (wasteByCategory[category] || 0) + weight;
    });
    
    // Calculate recycling rates (percentage of total)
    const recyclingRates: Record<string, number> = {};
    Object.entries(wasteByCategory).forEach(([category, weight]) => {
      recyclingRates[category] = totalWaste > 0 ? (weight / totalWaste) * 100 : 0;
    });
    
    // Calculate plastic recycled (Plastic + PET categories)
    const plasticRecycled = (wasteByCategory['Plastic'] || 0) + (wasteByCategory['PET'] || 0);
    
    // Carbon emission reduction (1 ton recycled = 1.5 tons CO2 saved)
    const carbonReduction = (totalWaste / 1000) * 1.5;
    
    // CO2 equivalent avoided (same as carbon reduction)
    const co2Equivalent = carbonReduction;
    
    // Waste recovery rate (percentage of waste that was recycled)
    const wasteRecoveryRate = totalWaste > 0 ? 85 : 0; // Estimated based on collection efficiency
    
    // Additional environmental metrics
    // Water saved: Recycling 1 ton of paper saves ~7,000 gallons, plastic ~1,800 gallons
    const waterSaved = (plasticRecycled / 1000) * 1800 + (wasteByCategory['Paper'] / 1000) * 7000;
    
    // Energy saved: Recycling 1 kg of plastic saves ~80 MJ, aluminum ~200 MJ
    const energySaved = (plasticRecycled / 1000) * 80 + (wasteByCategory['Metal'] / 1000) * 200;
    
    // Trees saved: 1 tree = 17 reams of paper, 1 ton of paper = 17 trees
    const treesSaved = (wasteByCategory['Paper'] / 1000) * 17;
    
    setMetrics({
      wasteDivertedLandfill: totalWaste,
      recyclingRates,
      carbonEmissionReduction: carbonReduction,
      plasticRecycled,
      wasteRecoveryRate,
      co2EquivalentAvoided: co2Equivalent,
      waterSaved: Math.round(waterSaved),
      energySaved: Math.round(energySaved),
      treesSaved: Math.round(treesSaved)
    });
  };

  const calculateMonthlyTrends = (requests: WasteRequest[]) => {
    const monthlyData: Record<string, { weight: number; plastic: number }> = {};
    
    requests.forEach(req => {
      if (req.created_at) {
        const date = new Date(req.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const weight = req.weight_kg || 0;
        const category = req.waste_category || req.category || 'General';
        const isPlastic = category === 'Plastic' || category === 'PET';
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { weight: 0, plastic: 0 };
        }
        monthlyData[monthKey].weight += weight;
        if (isPlastic) monthlyData[monthKey].plastic += weight;
      }
    });
    
    const trends = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, data]) => ({
        month: new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        weight: data.weight,
        co2Saved: (data.weight / 1000) * 1.5,
        plasticRecycled: data.plastic
      }));
    
    setMonthlyTrends(trends);
  };

  const getFilteredData = () => {
    if (selectedCategory === 'all') return wasteRequests;
    return wasteRequests.filter(req => {
      const category = req.waste_category || req.category || 'General';
      return category === selectedCategory;
    });
  };

  const filteredData = getFilteredData();
  const totalFilteredWeight = filteredData.reduce((sum, req) => sum + (req.weight_kg || 0), 0);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading sustainability dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>🌱 Sustainability Dashboard</h1>
          <p>Track environmental impact and sustainability metrics</p>
        </div>
        <div className={styles.headerInfo}>
          <span className={styles.welcomeBadge}>Welcome, {userName}</span>
          <div className={styles.dateBadge}>
            {new Date().toLocaleDateString(undefined, { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </div>

      {/* Main Impact Metrics Cards */}
      <div className={styles.impactGrid}>
        <div className={styles.impactCard}>
          <div className={styles.impactIcon}>🗑️➡️♻️</div>
          <div className={styles.impactValue}>{(metrics.wasteDivertedLandfill / 1000).toFixed(2)} tonnes</div>
          <div className={styles.impactLabel}>Waste Diverted from Landfill</div>
          <div className={styles.impactSubtext}>Total recyclables collected</div>
        </div>
        
        <div className={styles.impactCard}>
          <div className={styles.impactIcon}>🌍</div>
          <div className={styles.impactValue}>{metrics.carbonEmissionReduction.toFixed(2)} tonnes</div>
          <div className={styles.impactLabel}>CO₂ Equivalent Avoided</div>
          <div className={styles.impactSubtext}>Carbon emission reduction</div>
        </div>
        
        <div className={styles.impactCard}>
          <div className={styles.impactIcon}>🥤</div>
          <div className={styles.impactValue}>{(metrics.plasticRecycled / 1000).toFixed(2)} tonnes</div>
          <div className={styles.impactLabel}>Plastic Recycled</div>
          <div className={styles.impactSubtext}>Single-use plastic equivalent</div>
        </div>
        
        <div className={styles.impactCard}>
          <div className={styles.impactIcon}>📊</div>
          <div className={styles.impactValue}>{metrics.wasteRecoveryRate.toFixed(1)}%</div>
          <div className={styles.impactLabel}>Waste Recovery Rate</div>
          <div className={styles.impactSubtext}>Of total waste collected</div>
        </div>
      </div>

      {/* Secondary Environmental Metrics */}
      <div className={styles.secondaryGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>💧</div>
          <div className={styles.metricValue}>{metrics.waterSaved.toLocaleString()} gallons</div>
          <div className={styles.metricLabel}>Water Saved</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>⚡</div>
          <div className={styles.metricValue}>{metrics.energySaved.toLocaleString()} MJ</div>
          <div className={styles.metricLabel}>Energy Saved</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>🌳</div>
          <div className={styles.metricValue}>{metrics.treesSaved.toLocaleString()}</div>
          <div className={styles.metricLabel}>Trees Saved</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>🏭</div>
          <div className={styles.metricValue}>{Math.round(metrics.co2EquivalentAvoided * 2.5)} cars</div>
          <div className={styles.metricLabel}>Cars off the road/year</div>
        </div>
      </div>

      {/* Recycling Rates by Category */}
      <div className={styles.sectionCard}>
        <h2>📊 Recycling Rates by Category</h2>
        <div className={styles.categoryGrid}>
          {Object.entries(metrics.recyclingRates).map(([category, rate]) => (
            <div key={category} className={styles.categoryCard}>
              <div className={styles.categoryHeader}>
                <span className={styles.categoryIcon}>
                  {category === 'Plastic' && '🥤'}
                  {category === 'PET' && '🥤'}
                  {category === 'Glass' && '🍾'}
                  {category === 'Organic' && '🍎'}
                  {category === 'Metal' && '🔩'}
                  {category === 'Paper' && '📄'}
                  {category === 'General' && '🗑️'}
                </span>
                <span className={styles.categoryName}>{category}</span>
              </div>
              <div className={styles.rateBar}>
                <div 
                  className={styles.rateFill}
                  style={{ width: `${rate}%` }}
                />
              </div>
              <div className={styles.rateValue}>{rate.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Trends Chart */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2>📈 Monthly Environmental Impact Trends</h2>
          <div className={styles.trendControls}>
            <button 
              className={`${styles.trendBtn} ${selectedPeriod === 'weekly' ? styles.active : ''}`}
              onClick={() => setSelectedPeriod('weekly')}
            >
              Weekly
            </button>
            <button 
              className={`${styles.trendBtn} ${selectedPeriod === 'monthly' ? styles.active : ''}`}
              onClick={() => setSelectedPeriod('monthly')}
            >
              Monthly
            </button>
            <button 
              className={`${styles.trendBtn} ${selectedPeriod === 'yearly' ? styles.active : ''}`}
              onClick={() => setSelectedPeriod('yearly')}
            >
              Yearly
            </button>
          </div>
        </div>
        
        <div className={styles.chartContainer}>
          <div className={styles.chartLegend}>
            <span className={styles.legendItem}>
              <span className={styles.legendColor} style={{ backgroundColor: '#4CAF50' }}></span>
              Waste Collected (kg)
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendColor} style={{ backgroundColor: '#2196F3' }}></span>
              CO₂ Saved (tonnes)
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendColor} style={{ backgroundColor: '#FF9800' }}></span>
              Plastic Recycled (kg)
            </span>
          </div>
          
          <div className={styles.barChart}>
            {monthlyTrends.map((trend, index) => (
              <div key={index} className={styles.chartBar}>
                <div className={styles.barLabels}>
                  <span className={styles.monthLabel}>{trend.month}</span>
                </div>
                <div className={styles.barsContainer}>
                  <div 
                    className={styles.barWeight}
                    style={{ height: `${Math.min(100, (trend.weight / Math.max(...monthlyTrends.map(t => t.weight), 1)) * 100)}px` }}
                    title={`Waste: ${trend.weight.toLocaleString()} kg`}
                  />
                  <div 
                    className={styles.barCO2}
                    style={{ height: `${Math.min(100, (trend.co2Saved / Math.max(...monthlyTrends.map(t => t.co2Saved), 1)) * 100)}px` }}
                    title={`CO₂: ${trend.co2Saved.toFixed(2)} tonnes`}
                  />
                  <div 
                    className={styles.barPlastic}
                    style={{ height: `${Math.min(100, (trend.plasticRecycled / Math.max(...monthlyTrends.map(t => t.plasticRecycled), 1)) * 100)}px` }}
                    title={`Plastic: ${trend.plasticRecycled.toLocaleString()} kg`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SDG Goals Alignment */}
      <div className={styles.sectionCard}>
        <h2>🎯 SDG Goals Alignment</h2>
        <div className={styles.sdgGrid}>
          <div className={styles.sdgCard}>
            <div className={styles.sdgIcon}>🎯</div>
            <div className={styles.sdgNumber}>SDG 12</div>
            <div className={styles.sdgTitle}>Responsible Consumption & Production</div>
            <div className={styles.sdgProgress}>
              <div className={styles.sdgProgressBar} style={{ width: `${Math.min(100, (metrics.wasteRecoveryRate / 100) * 100)}%` }} />
            </div>
            <div className={styles.sdgValue}>{metrics.wasteRecoveryRate.toFixed(1)}% waste recovery</div>
          </div>
          
          <div className={styles.sdgCard}>
            <div className={styles.sdgIcon}>🌍</div>
            <div className={styles.sdgNumber}>SDG 13</div>
            <div className={styles.sdgTitle}>Climate Action</div>
            <div className={styles.sdgProgress}>
              <div className={styles.sdgProgressBar} style={{ width: `${Math.min(100, (metrics.carbonEmissionReduction / 1000) * 100)}%` }} />
            </div>
            <div className={styles.sdgValue}>{metrics.carbonEmissionReduction.toFixed(2)} tonnes CO₂ saved</div>
          </div>
          
          <div className={styles.sdgCard}>
            <div className={styles.sdgIcon}>🐟</div>
            <div className={styles.sdgNumber}>SDG 14</div>
            <div className={styles.sdgTitle}>Life Below Water</div>
            <div className={styles.sdgProgress}>
              <div className={styles.sdgProgressBar} style={{ width: `${Math.min(100, (metrics.plasticRecycled / 10000) * 100)}%` }} />
            </div>
            <div className={styles.sdgValue}>{(metrics.plasticRecycled / 1000).toFixed(2)} tonnes plastic recycled</div>
          </div>
          
          <div className={styles.sdgCard}>
            <div className={styles.sdgIcon}>🌳</div>
            <div className={styles.sdgNumber}>SDG 15</div>
            <div className={styles.sdgTitle}>Life on Land</div>
            <div className={styles.sdgProgress}>
              <div className={styles.sdgProgressBar} style={{ width: `${Math.min(100, (metrics.treesSaved / 1000) * 100)}%` }} />
            </div>
            <div className={styles.sdgValue}>{metrics.treesSaved.toLocaleString()} trees saved</div>
          </div>
        </div>
      </div>

      {/* Recent Collection Data */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2>📋 Recent Waste Collections</h2>
          <div className={styles.filterGroup}>
            <select 
              className={styles.categoryFilter}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="Plastic">Plastic</option>
              <option value="PET">PET</option>
              <option value="Glass">Glass</option>
              <option value="Organic">Organic</option>
              <option value="Metal">Metal</option>
              <option value="Paper">Paper</option>
              <option value="General">General</option>
            </select>
          </div>
        </div>
        
        <div className={styles.statsSummary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Weight:</span>
            <span className={styles.summaryValue}>{totalFilteredWeight.toLocaleString()} kg</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Items:</span>
            <span className={styles.summaryValue}>{filteredData.length}</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Avg Weight/Item:</span>
            <span className={styles.summaryValue}>
              {filteredData.length > 0 ? (totalFilteredWeight / filteredData.length).toFixed(1) : 0} kg
            </span>
          </div>
        </div>
        
        <div className={styles.tableWrapper}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Category</th>
                <th>Grade</th>
                <th>Weight (kg)</th>
                <th>CO₂ Saved (kg)</th>
                <th>Collector</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.slice(0, 20).map((request) => {
                const weight = request.weight_kg || 0;
                const co2Saved = (weight / 1000) * 1500;
                return (
                  <tr key={request.id}>
                    <td>{request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>{request.client_name || 'Unknown'}</td>
                    <td>
                      <span className={styles.categoryTag}>
                        {request.waste_category || request.category || 'General'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.gradeTag} ${styles[`grade${request.waste_grade || 'G2'}`]}`}>
                        {request.waste_grade || 'G2'}
                      </span>
                    </td>
                    <td className={styles.numberCell}>{weight.toLocaleString()}</td>
                    <td className={styles.numberCell}>{co2Saved.toFixed(1)}</td>
                    <td>{request.WMS_name || 'N/A'}</td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyTable}>
                    No collection data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Environmental Impact Summary */}
      <div className={styles.summarySection}>
        <h2>🌿 Environmental Impact Summary</h2>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>🏭</div>
            <div className={styles.summaryText}>
              <div className={styles.summaryTitle}>Carbon Footprint Reduction</div>
              <div className={styles.summaryDescription}>
                Equivalent to removing <strong>{Math.round(metrics.carbonEmissionReduction * 2.5)} cars</strong> from the road for one year
              </div>
            </div>
          </div>
          
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>💧</div>
            <div className={styles.summaryText}>
              <div className={styles.summaryTitle}>Water Conservation</div>
              <div className={styles.summaryDescription}>
                Saved enough water to fill <strong>{Math.round(metrics.waterSaved / 10000)} Olympic swimming pools</strong>
              </div>
            </div>
          </div>
          
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>⚡</div>
            <div className={styles.summaryText}>
              <div className={styles.summaryTitle}>Energy Conservation</div>
              <div className={styles.summaryDescription}>
                Saved enough energy to power <strong>{Math.round(metrics.energySaved / 3650)} homes</strong> for one year
              </div>
            </div>
          </div>
          
          <div className={styles.summaryCard}>
            <div className={styles.summaryIcon}>🌳</div>
            <div className={styles.summaryText}>
              <div className={styles.summaryTitle}>Forest Conservation</div>
              <div className={styles.summaryDescription}>
                Saved the equivalent of <strong>{metrics.treesSaved.toLocaleString()} trees</strong> from being cut down
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}