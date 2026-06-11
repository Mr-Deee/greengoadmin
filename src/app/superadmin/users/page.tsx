'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { ref, onValue, update, remove, set, push } from 'firebase/database';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import styles from './users.module.css';

// User role definitions - Aggregator includes Recycling Hub functionality
const USER_ROLES: Record<string, {
  name: string;
  icon: string;
  description: string;
  node: string;
  category: string;
  color: string;
}> = {
  super_admin: {
    name: 'Super Admin',
    icon: '👑',
    description: 'Full system control and user management',
    node: 'Admin',
    category: 'Administration',
    color: '#F44336'
  },
  aggregator: {
    name: 'Aggregator',
    icon: '🏢',
    description: 'Manages waste collection, aggregation, and recycling operations',
    node: 'Aggregators',
    category: 'Waste Management',
    color: '#2196F3'
  },
  field_operator: {
    name: 'Field Operator',
    icon: '👷',
    description: 'Collects waste from generators',
    node: 'FieldOperators',
    category: 'Waste Management',
    color: '#4CAF50'
  },
  business: {
    name: 'Business',
    icon: '🏭',
    description: 'Purchases recyclable materials',
    node: 'Businesses',
    category: 'Business & Investment',
    color: '#795548'
  },
  investor: {
    name: 'Investor',
    icon: '💰',
    description: 'Market analysis and investment opportunities',
    node: 'Investors',
    category: 'Business & Investment',
    color: '#FFC107'
  },
  government: {
    name: 'Government',
    icon: '🏛️',
    description: 'Monitors compliance and performance',
    node: 'Government',
    category: 'Government & Regulatory',
    color: '#607D8B'
  },
  regulator: {
    name: 'Regulator',
    icon: '⚖️',
    description: 'Licensing and compliance enforcement',
    node: 'Regulators',
    category: 'Government & Regulatory',
    color: '#3F51B5'
  },
  policy_maker: {
    name: 'Policy Maker',
    icon: '📜',
    description: 'Strategic planning and policy development',
    node: 'PolicyMakers',
    category: 'Government & Regulatory',
    color: '#673AB7'
  },
  ngo: {
    name: 'NGO',
    icon: '🤝',
    description: 'Community outreach and impact tracking',
    node: 'NGOs',
    category: 'Civil Society & Sustainability',
    color: '#8BC34A'
  },
  sustainability_team: {
    name: 'Sustainability Team',
    icon: '🌱',
    description: 'Environmental impact monitoring',
    node: 'Sustainability',
    category: 'Civil Society & Sustainability',
    color: '#009688'
  },
  civil_society: {
    name: 'Civil Society',
    icon: '👥',
    description: 'Advocacy and transparency',
    node: 'CivilSociety',
    category: 'Civil Society & Sustainability',
    color: '#E91E63'
  },
  platform_manager: {
    name: 'Platform Manager',
    icon: '📱',
    description: 'Manages platform operations',
    node: 'PlatformManagers',
    category: 'Platform Management',
    color: '#00BCD4'
  },
  platform_leadership: {
    name: 'Platform Leadership',
    icon: '👑',
    description: 'Platform strategy and growth',
    node: 'PlatformLeadership',
    category: 'Platform Management',
    color: '#FF9800'
  },
  client: {
    name: 'Client (Waste Generator)',
    icon: '🏠',
    description: 'Households, institutions, and organizations that generate waste',
    node: 'Clients',
    category: 'Waste Generators',
    color: '#4CAF50'
  }
};

interface User {
  id: string;
  uid: string;
  email: string;
  name: string;
  firstName?: string;
  LastName?: string;
  role: string;
  organization?: string;
  phone?: string;
  phoneNumber?: string;
  district?: string;
  region?: string;
  location?: string;
  settlementType?: string;
  gpsAddress?: string;
  ghCardNo?: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt: string;
  createdBy?: string;
  WMSTYPE?: string;
  WMSCATEGORY?: string;
  detailsComp?: boolean;
  wasteManagementInfo?: {
    CompanyName?: string;
    location?: string;
    RecycleType?: string;
    district?: string;
    employees?: string;
  };
  department?: string;
  position?: string;
  agency?: string;
}

interface WasteManagementInfo {
  CompanyName?: string;
  location?: string;
  RecycleType?: string;
  employees?: string;
  district?: string;
}

interface UserData {
  uid: string;
  email: string;
  firstName: string;
  LastName: string;
  name: string;
  role: string;
  phone: string;
  phoneNumber: string;
  district: string;
  region: string;
  organization: string;
  status: string;
  createdAt: string;
  createdBy?: string;
  location?: string;
  SettlementType?: string;
  gpsAddress?: string;
  ghCardNo?: string;
  WMSTYPE?: string;
  WMSCATEGORY?: string;
  detailsComp?: boolean;
  wasteManagementInfo?: WasteManagementInfo;
  userType?: string;
  isActive?: boolean;
  assignedDistrict?: string;
  department?: string;
  position?: string;
  agency?: string;
}

interface AuditLog {
  action: string;
  userId: string;
  userEmail: string;
  role: string;
  createdBy?: string;
  timestamp: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const [showRoleCards, setShowRoleCards] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: '',
    organization: '',
    phone: '',
    district: '',
    region: '',
    location: '',
    settlementType: '',
    gpsAddress: '',
    ghCardNo: '',
    department: '',
    position: '',
    agency: '',
    status: 'pending'
  });

  useEffect(() => {
    fetchAllUsers();
  }, []);

  const fetchAllUsers = () => {
    const allUsers: User[] = [];
    let completedFetches = 0;
    const nodes = ['Admin', 'Clients', 'Aggregators', 'Recyclers', 'FieldOperators', 'Businesses', 'Investors', 'Government', 'Regulators', 'PolicyMakers', 'NGOs', 'Sustainability', 'CivilSociety', 'PlatformManagers', 'PlatformLeadership'];
    const totalNodes = nodes.length;

    nodes.forEach(node => {
      const nodeRef = ref(db, node);
      onValue(nodeRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const usersFromNode = Object.keys(data).map(key => ({
            id: key,
            uid: key,
            ...(data[key] as object)
          })) as User[];
          
          usersFromNode.forEach(user => {
            let role = user.role || '';
            if (!role) {
              if (node === 'Admin') role = 'super_admin';
              else if (node === 'Clients') role = 'client';
              else if (node === 'Aggregators') role = 'aggregator';
              else if (node === 'Recyclers') role = 'aggregator';
              else if (node === 'FieldOperators') role = 'field_operator';
              else if (node === 'Businesses') role = 'business';
              else if (node === 'Investors') role = 'investor';
              else if (node === 'Government') role = 'government';
              else if (node === 'Regulators') role = 'regulator';
              else if (node === 'PolicyMakers') role = 'policy_maker';
              else if (node === 'NGOs') role = 'ngo';
              else if (node === 'Sustainability') role = 'sustainability_team';
              else if (node === 'CivilSociety') role = 'civil_society';
              else if (node === 'PlatformManagers') role = 'platform_manager';
              else if (node === 'PlatformLeadership') role = 'platform_leadership';
            }
            
            const existingIndex = allUsers.findIndex(u => u.uid === user.uid);
            if (existingIndex === -1) {
              let status: 'active' | 'pending' | 'suspended' = 'active';
              if (user.status === 'suspended') status = 'suspended';
              else if (user.status === 'pending') status = 'pending';
              else if (user.detailsComp === false) status = 'pending';
              
              allUsers.push({ ...user, role, status });
            }
          });
        }
        completedFetches++;
        if (completedFetches === totalNodes) {
          setUsers(allUsers);
          setLoading(false);
        }
      }, (error) => {
        console.error(`Error fetching from ${node}:`, error);
        completedFetches++;
        if (completedFetches === totalNodes) {
          setLoading(false);
        }
      });
    });
  };

  const showToast = (message: string, type: string) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'aggregator': return 'Aggregator';
      case 'field_operator': return 'Field Operator';
      case 'super_admin': return 'Super Admin';
      case 'platform_manager': return 'Platform Manager';
      case 'platform_leadership': return 'Platform Leadership';
      case 'sustainability_team': return 'Sustainability Team';
      case 'civil_society': return 'Civil Society';
      case 'policy_maker': return 'Policy Maker';
      case 'client': return 'Client';
      default: return USER_ROLES[role]?.name || role;
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.firstName || !formData.role) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const uid = userCredential.user.uid;
      
      const roleConfig = USER_ROLES[formData.role];
      const nodePath = roleConfig?.node || 'Users';
      
      const userData: UserData = {
        uid: uid,
        email: formData.email,
        firstName: formData.firstName,
        LastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        role: formData.role,
        phone: formData.phone || '',
        phoneNumber: formData.phone || '',
        district: formData.district || '',
        region: formData.region || '',
        organization: formData.organization || '',
        status: formData.status === 'active' ? 'active' : 'pending',
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid
      };
      
      // Add role-specific fields
      if (formData.role === 'client') {
        userData.location = formData.location || '';
        userData.SettlementType = formData.settlementType || 'Household';
        userData.gpsAddress = formData.gpsAddress || '';
        userData.ghCardNo = formData.ghCardNo || '';
        userData.userType = 'client';
        userData.isActive = true;
      } else if (formData.role === 'aggregator') {
        userData.WMSTYPE = 'Recycle';
        userData.WMSCATEGORY = 'Primary';
        userData.detailsComp = true;
        userData.wasteManagementInfo = {
          CompanyName: formData.organization || 'Aggregation Facility',
          location: formData.district,
          RecycleType: 'Primary',
          employees: '1',
          district: formData.district
        };
      } else if (formData.role === 'field_operator') {
        userData.assignedDistrict = formData.district;
        userData.status = 'active';
      } else if (formData.role === 'government') {
        userData.department = formData.department || '';
      } else if (formData.role === 'policy_maker') {
        userData.position = formData.position || '';
      } else if (formData.role === 'regulator') {
        userData.agency = formData.agency || '';
      }
      
      await set(ref(db, `${nodePath}/${uid}`), userData);
      
      const auditRef = push(ref(db, 'auditLogs'));
      const auditLog: AuditLog = {
        action: 'user_created',
        userId: uid,
        userEmail: formData.email,
        role: formData.role,
        createdBy: auth.currentUser?.uid,
        timestamp: new Date().toISOString()
      };
      await set(auditRef, auditLog);
      
      showToast(`User ${formData.firstName} ${formData.lastName} created successfully!`, 'success');
      setShowCreateModal(false);
      resetForm();
      fetchAllUsers();
      
    } catch (error: unknown) {
      console.error('Error creating user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      showToast(errorMessage, 'error');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      const roleConfig = USER_ROLES[formData.role];
      const nodePath = roleConfig?.node || 'Users';
      
      const userRef = ref(db, `${nodePath}/${selectedUser.id}`);
      
      const updateData: Record<string, string | boolean | undefined> = {
        firstName: formData.firstName,
        LastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        phoneNumber: formData.phone,
        district: formData.district,
        region: formData.region,
        organization: formData.organization,
        status: formData.status,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.uid
      };
      
      if (formData.role === 'client') {
        updateData.location = formData.location;
        updateData.SettlementType = formData.settlementType;
        updateData.gpsAddress = formData.gpsAddress;
        updateData.ghCardNo = formData.ghCardNo;
      }
      
      await update(userRef, updateData);
      
      const auditRef = push(ref(db, 'auditLogs'));
      const auditLog: AuditLog = {
        action: 'user_updated',
        userId: selectedUser.uid,
        userEmail: selectedUser.email,
        role: formData.role,
        createdBy: auth.currentUser?.uid,
        timestamp: new Date().toISOString()
      };
      await set(auditRef, auditLog);
      
      showToast(`User updated successfully!`, 'success');
      setShowEditModal(false);
      setSelectedUser(null);
      fetchAllUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('Failed to update user', 'error');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.name || user.firstName}? This action cannot be undone.`)) {
      return;
    }

    try {
      let nodePath = '';
      if (user.role === 'super_admin') nodePath = 'Admin';
      else if (user.role === 'client') nodePath = 'Clients';
      else if (user.role === 'aggregator') nodePath = 'Aggregators';
      else if (user.role === 'field_operator') nodePath = 'FieldOperators';
      else nodePath = 'Users';
      
      await remove(ref(db, `${nodePath}/${user.id}`));
      
      const auditRef = push(ref(db, 'auditLogs'));
      const auditLog: AuditLog = {
        action: 'user_deleted',
        userId: user.uid,
        userEmail: user.email,
        role: user.role,
        createdBy: auth.currentUser?.uid,
        timestamp: new Date().toISOString()
      };
      await set(auditRef, auditLog);
      
      showToast(`User deleted successfully!`, 'success');
      fetchAllUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('Failed to delete user', 'error');
    }
  };

  const handleSuspendUser = async (user: User) => {
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended';
    
    try {
      let nodePath = '';
      if (user.role === 'super_admin') nodePath = 'Admin';
      else if (user.role === 'client') nodePath = 'Clients';
      else if (user.role === 'aggregator') nodePath = 'Aggregators';
      else if (user.role === 'field_operator') nodePath = 'FieldOperators';
      else nodePath = 'Users';
      
      await update(ref(db, `${nodePath}/${user.id}`), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      showToast(`User ${user.firstName || user.name} ${newStatus === 'suspended' ? 'suspended' : 'activated'}!`, 'success');
      fetchAllUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      showToast('Failed to update user status', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: '',
      organization: '',
      phone: '',
      district: '',
      region: '',
      location: '',
      settlementType: '',
      gpsAddress: '',
      ghCardNo: '',
      department: '',
      position: '',
      agency: '',
      status: 'pending'
    });
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: '',
      firstName: user.firstName || user.name?.split(' ')[0] || '',
      lastName: user.LastName || user.name?.split(' ').slice(1).join(' ') || '',
      role: user.role,
      organization: user.organization || user.wasteManagementInfo?.CompanyName || '',
      phone: user.phone || user.phoneNumber || '',
      district: user.district || user.wasteManagementInfo?.district || '',
      region: user.region || '',
      location: user.location || '',
      settlementType: user.settlementType || '',
      gpsAddress: user.gpsAddress || '',
      ghCardNo: user.ghCardNo || '',
      department: user.department || '',
      position: user.position || '',
      agency: user.agency || '',
      status: user.status
    });
    setShowEditModal(true);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      (user.firstName || user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleCount = (role: string) => users.filter(u => u.role === role).length;

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>👥 User Management</h1>
          <p>Manage all platform users - Aggregators, Field Operators, Businesses, Government, NGOs, and more</p>
        </div>
        <button 
          className={styles.createButton}
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          + Create New User
        </button>
      </div>

      {/* Main Statistics Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{users.length}</div>
            <div className={styles.statLabel}>Total Users</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.active}`}>
          <div className={styles.statIcon}>🟢</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{users.filter(u => u.status === 'active').length}</div>
            <div className={styles.statLabel}>Active</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.pending}`}>
          <div className={styles.statIcon}>⏳</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{users.filter(u => u.status === 'pending').length}</div>
            <div className={styles.statLabel}>Pending</div>
          </div>
        </div>
        <div className={`${styles.statCard} ${styles.suspended}`}>
          <div className={styles.statIcon}>⛔</div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{users.filter(u => u.status === 'suspended').length}</div>
            <div className={styles.statLabel}>Suspended</div>
          </div>
        </div>
      </div>

      {/* Role Cards Section with Toggle */}
      <div className={styles.sectionHeaderWithToggle}>
        <h3>📊 Role Distribution</h3>
        <button
          className={styles.toggleCardsBtn}
          onClick={() => setShowRoleCards(!showRoleCards)}
        >
          {showRoleCards ? 'Hide Cards ▲' : 'Show Cards ▼'}
        </button>
      </div>

      {showRoleCards && (
        <div className={styles.roleCardsGrid}>
          {Object.entries(USER_ROLES).map(([key, value]) => (
            <div key={key} className={styles.roleCard} style={{ borderTopColor: value.color }}>
              <div className={styles.roleCardIcon}>{value.icon}</div>
              <div className={styles.roleCardInfo}>
                <div className={styles.roleCardName}>{value.name}</div>
                <div className={styles.roleCardCount}>{getRoleCount(key)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersBar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by name or email..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select 
          className={styles.filterSelect}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="super_admin">👑 Super Admin</option>
          <option value="aggregator">🏢 Aggregator</option>
          <option value="field_operator">👷 Field Operator</option>
          <option value="business">🏭 Business</option>
          <option value="investor">💰 Investor</option>
          <option value="government">🏛️ Government</option>
          <option value="regulator">⚖️ Regulator</option>
          <option value="policy_maker">📜 Policy Maker</option>
          <option value="ngo">🤝 NGO</option>
          <option value="sustainability_team">🌱 Sustainability Team</option>
          <option value="civil_society">👥 Civil Society</option>
          <option value="platform_manager">📱 Platform Manager</option>
          <option value="platform_leadership">👑 Platform Leadership</option>
          <option value="client">🏠 Client</option>
        </select>

        <select 
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Users Table */}
      <div className={styles.tableContainer}>
        <table className={styles.userTable}>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Organization/Location</th>
              <th>District/Region</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td className={styles.userCell}>
                  <div className={styles.userAvatar}>
                    {((user.firstName || user.name || 'U').charAt(0)).toUpperCase()}
                  </div>
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>{user.firstName || user.name} {user.LastName || ''}</div>
                    <div className={styles.userEmail}>{user.email}</div>
                  </div>
                </td>
                <td>
                  <span className={styles.roleBadge}>
                    {USER_ROLES[user.role]?.icon || '👤'}
                    {' '}
                    {getRoleDisplayName(user.role)}
                  </span>
                </td>
                <td>{user.organization || user.location || user.wasteManagementInfo?.CompanyName || '—'}</td>
                <td>{user.district || user.region || user.wasteManagementInfo?.district || '—'}</td>
                <td>{user.phone || user.phoneNumber || '—'}</td>
                <td>
                  <span className={`${styles.statusBadge} ${styles[user.status]}`}>
                    {user.status === 'active' ? 'Active' : 
                     user.status === 'pending' ? 'Pending' : 'Suspended'}
                  </span>
                </td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className={styles.actionsCell}>
                  <button 
                    className={styles.editBtn}
                    onClick={() => openEditModal(user)}
                    title="Edit User"
                  >
                    ✏️
                  </button>
                  <button 
                    className={styles.suspendBtn}
                    onClick={() => handleSuspendUser(user)}
                    title={user.status === 'suspended' ? 'Activate User' : 'Suspend User'}
                  >
                    {user.status === 'suspended' ? '🔓' : '🔒'}
                  </button>
                  <button 
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteUser(user)}
                    title="Delete User"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <h3>No users found</h3>
            <p>Try adjusting your filters or create a new user</p>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className={styles.modal} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>➕ Create New User</h2>
              <button className={styles.closeBtn} onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleCreateUser} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    placeholder="Enter first name"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Email Address *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="user@example.com"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Password *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Role *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                >
                  <option value="">Select a role</option>
                  {Object.entries(USER_ROLES).map(([key, value]) => (
                    <option key={key} value={key}>{value.icon} {value.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="pending">Pending Approval</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="Phone number" />
                </div>
                <div className={styles.formGroup}>
                  <label>Organization/Company</label>
                  <input type="text" value={formData.organization} onChange={(e) => setFormData({...formData, organization: e.target.value})} placeholder="Company name" />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>District</label>
                  <input type="text" value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})} placeholder="Operating district" />
                </div>
                <div className={styles.formGroup}>
                  <label>Region</label>
                  <input type="text" value={formData.region} onChange={(e) => setFormData({...formData, region: e.target.value})} placeholder="Region" />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className={styles.modal} onClick={() => setShowEditModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>✏️ Edit User</h2>
              <button className={styles.closeBtn} onClick={() => setShowEditModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleUpdateUser} className={styles.form}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>First Name</label>
                  <input type="text" value={formData.firstName} onChange={(e) => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name</label>
                  <input type="text" value={formData.lastName} onChange={(e) => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Email</label>
                <input type="email" value={formData.email} disabled />
                <small>Email cannot be changed</small>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Role</label>
                  <input type="text" value={formData.role} disabled />
                </div>
                <div className={styles.formGroup}>
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label>Organization</label>
                  <input type="text" value={formData.organization} onChange={(e) => setFormData({...formData, organization: e.target.value})} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>District</label>
                  <input type="text" value={formData.district} onChange={(e) => setFormData({...formData, district: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label>Region</label>
                  <input type="text" value={formData.region} onChange={(e) => setFormData({...formData, region: e.target.value})} />
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className={styles.submitBtn}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}