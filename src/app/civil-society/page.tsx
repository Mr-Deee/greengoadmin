'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, get, push, set } from 'firebase/database';
import { useRouter } from 'next/navigation';
import styles from'./civilsociety.module.css'
interface WasteRequest {
  id: string;
  client_name?: string;
  category?: string;
  waste_category?: string;
  waste_grade?: string;
  status?: string;
  weight?: string;
  weight_kg?: number;
  created_at?: string;
  location?: string;
  WMS_name?: string;
  calculated_price?: number;
}

interface Feedback {
  id: string;
  userId: string;
  userName: string;
  message: string;
  rating: number;
  category: 'complaint' | 'suggestion' | 'praise' | 'inquiry';
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string;
  response?: string;
  respondedAt?: string;
  respondedBy?: string;
}

interface TransparencyReport {
  totalWasteCollected: number;
  totalRevenue: number;
  activeRecyclers: number;
  completedRequests: number;
  pendingRequests: number;
  wasteByCategory: Record<string, number>;
  co2Reduction: number;
  plasticRecycled: number;
}

export default function CivilSocietyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [wasteRequests, setWasteRequests] = useState<WasteRequest[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    message: '',
    rating: 5,
    category: 'suggestion' as 'complaint' | 'suggestion' | 'praise' | 'inquiry'
  });
  const [transparencyReport, setTransparencyReport] = useState<TransparencyReport>({
    totalWasteCollected: 0,
    totalRevenue: 0,
    activeRecyclers: 0,
    completedRequests: 0,
    pendingRequests: 0,
    wasteByCategory: {},
    co2Reduction: 0,
    plasticRecycled: 0
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [showReportModal, setShowReportModal] = useState(false);

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
        
        // If not admin, check in CivilSociety node
        if (!role) {
          const civilRef = ref(db, `CivilSociety/${user.uid}`);
          const civilSnapshot = await get(civilRef);
          const civilData = civilSnapshot.val();
          
          if (civilData) {
            role = civilData.role || 'civil_society';
            name = civilData.name || civilData.firstName || user.email?.split('@')[0] || 'Civil Society';
          }
        }
        
        // Check if user has access to civil society dashboard
        const allowedRoles = ['civil_society', 'super_admin', 'government', 'ngo'];
        if (!role || !allowedRoles.includes(role)) {
          router.push('/unauthorized');
          return;
        }
        
        setUserName(name);
        loadWasteData();
        loadFeedbacks();
        
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
        
        setWasteRequests(requestsArray);
        
        // Calculate transparency report
        const completedRequests = requestsArray.filter(req => req.status === 'ended');
        const pendingRequests = requestsArray.filter(req => 
          req.status === 'searching' || req.status === 'accepted' || req.status === 'onride'
        );
        
        const totalWeight = completedRequests.reduce((sum, req) => sum + (req.weight_kg || 0), 0);
        const totalRevenue = completedRequests.reduce((sum, req) => sum + (req.calculated_price || 0), 0);
        
        // Calculate waste by category
        const wasteByCategory: Record<string, number> = {};
        completedRequests.forEach(req => {
          const category = req.waste_category || req.category || 'General';
          const weight = req.weight_kg || 0;
          wasteByCategory[category] = (wasteByCategory[category] || 0) + weight;
        });
        
        // Calculate plastic recycled
        const plasticRecycled = (wasteByCategory['Plastic'] || 0) + (wasteByCategory['PET'] || 0);
        
        // CO2 reduction (1 ton recycled = 1.5 tons CO2)
        const co2Reduction = (totalWeight / 1000) * 1.5;
        
        setTransparencyReport({
          totalWasteCollected: totalWeight,
          totalRevenue: totalRevenue,
          activeRecyclers: 0, // Will be updated from Recyclers node
          completedRequests: completedRequests.length,
          pendingRequests: pendingRequests.length,
          wasteByCategory,
          co2Reduction,
          plasticRecycled
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  };

  const loadFeedbacks = () => {
    const feedbacksRef = ref(db, 'feedbacks');
    
    const unsubscribe = onValue(feedbacksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const feedbacksArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })) as Feedback[];
        
        setFeedbacks(feedbacksArray.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      }
    });

    return () => unsubscribe();
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
      alert('Please login to submit feedback');
      return;
    }
    
    try {
      const feedbacksRef = ref(db, 'feedbacks');
      const newFeedbackRef = push(feedbacksRef);
      
      await set(newFeedbackRef, {
        userId: user.uid,
        userName: userName,
        message: feedbackForm.message,
        rating: feedbackForm.rating,
        category: feedbackForm.category,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      
      alert('Thank you for your feedback!');
      setShowFeedbackModal(false);
      setFeedbackForm({ message: '', rating: 5, category: 'suggestion' });
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    }
  };

  const getStatusCounts = () => {
    const counts = {
      pending: 0,
      reviewed: 0,
      resolved: 0
    };
    
    feedbacks.forEach(f => {
      if (f.status === 'pending') counts.pending++;
      else if (f.status === 'reviewed') counts.reviewed++;
      else if (f.status === 'resolved') counts.resolved++;
    });
    
    return counts;
  };

  const getCategoryCounts = () => {
    const counts = {
      complaint: 0,
      suggestion: 0,
      praise: 0,
      inquiry: 0
    };
    
    feedbacks.forEach(f => {
      if (f.category === 'complaint') counts.complaint++;
      else if (f.category === 'suggestion') counts.suggestion++;
      else if (f.category === 'praise') counts.praise++;
      else if (f.category === 'inquiry') counts.inquiry++;
    });
    
    return counts;
  };

  const statusCounts = getStatusCounts();
  const categoryCounts = getCategoryCounts();

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading civil society dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>👥 Civil Society Dashboard</h1>
          <p>Promoting transparency, accountability, and community engagement</p>
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

      {/* Transparency Metrics */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2>📊 Transparency Dashboard</h2>
          <button 
            className={styles.reportBtn}
            onClick={() => setShowReportModal(true)}
          >
            📄 View Full Report
          </button>
        </div>
        
        <div className={styles.transparencyGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>🗑️</div>
            <div className={styles.metricValue}>{transparencyReport.totalWasteCollected.toLocaleString()} kg</div>
            <div className={styles.metricLabel}>Total Waste Collected</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>💰</div>
            <div className={styles.metricValue}>₵{transparencyReport.totalRevenue.toLocaleString()}</div>
            <div className={styles.metricLabel}>Total Revenue Generated</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>✅</div>
            <div className={styles.metricValue}>{transparencyReport.completedRequests.toLocaleString()}</div>
            <div className={styles.metricLabel}>Completed Collections</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>⏳</div>
            <div className={styles.metricValue}>{transparencyReport.pendingRequests.toLocaleString()}</div>
            <div className={styles.metricLabel}>Pending Requests</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>🌍</div>
            <div className={styles.metricValue}>{transparencyReport.co2Reduction.toFixed(2)} tonnes</div>
            <div className={styles.metricLabel}>CO₂ Reduction</div>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricIcon}>🥤</div>
            <div className={styles.metricValue}>{(transparencyReport.plasticRecycled / 1000).toFixed(2)} tonnes</div>
            <div className={styles.metricLabel}>Plastic Recycled</div>
          </div>
        </div>
      </div>

      {/* Waste by Category */}
      <div className={styles.sectionCard}>
        <h2>📊 Waste Breakdown by Category</h2>
        <div className={styles.categoryGrid}>
          {Object.entries(transparencyReport.wasteByCategory).map(([category, weight]) => {
            const percentage = transparencyReport.totalWasteCollected > 0 
              ? (weight / transparencyReport.totalWasteCollected) * 100 
              : 0;
            return (
              <div key={category} className={styles.categoryItem}>
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
                  <span className={styles.categoryPercent}>{percentage.toFixed(1)}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className={styles.categoryWeight}>{weight.toLocaleString()} kg</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback Analytics */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2>💬 Community Feedback Analytics</h2>
          <button 
            className={styles.feedbackBtn}
            onClick={() => setShowFeedbackModal(true)}
          >
            + Give Feedback
          </button>
        </div>
        
        <div className={styles.feedbackStatsGrid}>
          <div className={styles.feedbackStatCard}>
            <div className={styles.feedbackStatIcon}>📝</div>
            <div className={styles.feedbackStatValue}>{feedbacks.length}</div>
            <div className={styles.feedbackStatLabel}>Total Feedback</div>
          </div>
          <div className={styles.feedbackStatCard}>
            <div className={styles.feedbackStatIcon}>⏳</div>
            <div className={styles.feedbackStatValue}>{statusCounts.pending}</div>
            <div className={styles.feedbackStatLabel}>Pending Review</div>
          </div>
          <div className={styles.feedbackStatCard}>
            <div className={styles.feedbackStatIcon}>👀</div>
            <div className={styles.feedbackStatValue}>{statusCounts.reviewed}</div>
            <div className={styles.feedbackStatLabel}>Reviewed</div>
          </div>
          <div className={styles.feedbackStatCard}>
            <div className={styles.feedbackStatIcon}>✅</div>
            <div className={styles.feedbackStatValue}>{statusCounts.resolved}</div>
            <div className={styles.feedbackStatLabel}>Resolved</div>
          </div>
        </div>

        <div className={styles.categoryStats}>
          <h3>Feedback by Category</h3>
          <div className={styles.categoryChart}>
            <div className={styles.chartBar}>
              <div className={styles.chartLabel}>Complaints</div>
              <div className={styles.chartBarContainer}>
                <div 
                  className={styles.chartFill}
                  style={{ width: `${(categoryCounts.complaint / (feedbacks.length || 1)) * 100}%`, backgroundColor: '#f44336' }}
                />
              </div>
              <div className={styles.chartCount}>{categoryCounts.complaint}</div>
            </div>
            <div className={styles.chartBar}>
              <div className={styles.chartLabel}>Suggestions</div>
              <div className={styles.chartBarContainer}>
                <div 
                  className={styles.chartFill}
                  style={{ width: `${(categoryCounts.suggestion / (feedbacks.length || 1)) * 100}%`, backgroundColor: '#2196F3' }}
                />
              </div>
              <div className={styles.chartCount}>{categoryCounts.suggestion}</div>
            </div>
            <div className={styles.chartBar}>
              <div className={styles.chartLabel}>Praise</div>
              <div className={styles.chartBarContainer}>
                <div 
                  className={styles.chartFill}
                  style={{ width: `${(categoryCounts.praise / (feedbacks.length || 1)) * 100}%`, backgroundColor: '#4CAF50' }}
                />
              </div>
              <div className={styles.chartCount}>{categoryCounts.praise}</div>
            </div>
            <div className={styles.chartBar}>
              <div className={styles.chartLabel}>Inquiries</div>
              <div className={styles.chartBarContainer}>
                <div 
                  className={styles.chartFill}
                  style={{ width: `${(categoryCounts.inquiry / (feedbacks.length || 1)) * 100}%`, backgroundColor: '#FF9800' }}
                />
              </div>
              <div className={styles.chartCount}>{categoryCounts.inquiry}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Feedback */}
      <div className={styles.sectionCard}>
        <h2>📋 Recent Community Feedback</h2>
        <div className={styles.feedbackList}>
          {feedbacks.slice(0, 10).map((feedback) => (
            <div key={feedback.id} className={styles.feedbackCard}>
              <div className={styles.feedbackHeader}>
                <div className={styles.feedbackUser}>
                  <span className={styles.userAvatar}>
                    {feedback.userName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className={styles.userName}>{feedback.userName}</div>
                    <div className={styles.feedbackDate}>
                      {new Date(feedback.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className={styles.feedbackMeta}>
                  <span className={`${styles.categoryBadge} ${styles[feedback.category]}`}>
                    {feedback.category}
                  </span>
                  <span className={`${styles.statusBadge} ${styles[feedback.status]}`}>
                    {feedback.status}
                  </span>
                </div>
              </div>
              <div className={styles.feedbackRating}>
                {'⭐'.repeat(feedback.rating)}{'☆'.repeat(5 - feedback.rating)}
              </div>
              <div className={styles.feedbackMessage}>{feedback.message}</div>
              {feedback.response && (
                <div className={styles.feedbackResponse}>
                  <strong>Response:</strong> {feedback.response}
                </div>
              )}
            </div>
          ))}
          {feedbacks.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💬</div>
              <h3>No feedback yet</h3>
              <p>Be the first to share your thoughts about the platform.</p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className={styles.modal} onClick={() => setShowFeedbackModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>💬 Share Your Feedback</h2>
              <button className={styles.closeBtn} onClick={() => setShowFeedbackModal(false)}>×</button>
            </div>
            
            <form onSubmit={submitFeedback} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Category *</label>
                <select
                  required
                  value={feedbackForm.category}
                  onChange={(e) => setFeedbackForm({...feedbackForm, category: e.target.value as any})}
                >
                  <option value="suggestion">💡 Suggestion</option>
                  <option value="complaint">⚠️ Complaint</option>
                  <option value="praise">🎉 Praise</option>
                  <option value="inquiry">❓ Inquiry</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>Rating</label>
                <div className={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`${styles.star} ${star <= feedbackForm.rating ? styles.active : ''}`}
                      onClick={() => setFeedbackForm({...feedbackForm, rating: star})}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label>Your Message *</label>
                <textarea
                  required
                  rows={5}
                  value={feedbackForm.message}
                  onChange={(e) => setFeedbackForm({...feedbackForm, message: e.target.value})}
                  placeholder="Share your thoughts, suggestions, or concerns..."
                />
              </div>
              
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowFeedbackModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transparency Report Modal */}
      {showReportModal && (
        <div className={styles.modal} onClick={() => setShowReportModal(false)}>
          <div className={styles.modalContentLarge} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>📄 Transparency Report</h2>
              <button className={styles.closeBtn} onClick={() => setShowReportModal(false)}>×</button>
            </div>
            
            <div className={styles.reportContent}>
              <div className={styles.reportDate}>
                Report generated: {new Date().toLocaleString()}
              </div>
              
              <div className={styles.reportSection}>
                <h3>Overall Performance</h3>
                <div className={styles.reportGrid}>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Total Waste Collected:</span>
                    <span className={styles.reportValue}>{transparencyReport.totalWasteCollected.toLocaleString()} kg</span>
                  </div>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Total Revenue:</span>
                    <span className={styles.reportValue}>₵{transparencyReport.totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Completed Collections:</span>
                    <span className={styles.reportValue}>{transparencyReport.completedRequests}</span>
                  </div>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Pending Requests:</span>
                    <span className={styles.reportValue}>{transparencyReport.pendingRequests}</span>
                  </div>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>CO₂ Reduction:</span>
                    <span className={styles.reportValue}>{transparencyReport.co2Reduction.toFixed(2)} tonnes</span>
                  </div>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Plastic Recycled:</span>
                    <span className={styles.reportValue}>{(transparencyReport.plasticRecycled / 1000).toFixed(2)} tonnes</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.reportSection}>
                <h3>Waste Breakdown by Category</h3>
                <div className={styles.reportCategoryGrid}>
                  {Object.entries(transparencyReport.wasteByCategory).map(([category, weight]) => (
                    <div key={category} className={styles.reportCategoryItem}>
                      <span>{category}:</span>
                      <span>{weight.toLocaleString()} kg</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className={styles.reportSection}>
                <h3>Community Engagement</h3>
                <div className={styles.reportGrid}>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Total Feedback Received:</span>
                    <span className={styles.reportValue}>{feedbacks.length}</span>
                  </div>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Pending Feedback:</span>
                    <span className={styles.reportValue}>{statusCounts.pending}</span>
                  </div>
                  <div className={styles.reportItem}>
                    <span className={styles.reportLabel}>Resolved Issues:</span>
                    <span className={styles.reportValue}>{statusCounts.resolved}</span>
                  </div>
                </div>
              </div>
              
              <div className={styles.reportActions}>
                <button 
                  className={styles.printBtn}
                  onClick={() => window.print()}
                >
                  🖨️ Print Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}