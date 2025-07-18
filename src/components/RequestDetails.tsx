// components/RequestDetails.tsx
import React from 'react';
import styles from './Model.module.css';
import { WasteManagementRequest } from '@/types';

interface RequestDetailsProps {
  request: WasteManagementRequest;
  onClose: () => void;
}

const RequestDetails: React.FC<RequestDetailsProps> = ({ request, onClose }) => {
  return (
    <div className={styles.detailsContainer}>
      <h2>Request Details</h2>
      
      <div className={styles.detailsGrid}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Client:</span>
          <span>{request.client_name}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Phone:</span>
          <span>{request.client_phone}</span>
        </div>
        {/* Add all other request details fields */}
      </div>
      
      <button 
        className={styles.closeButton}
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export default RequestDetails;