// components/UserForm.tsx
import React, { useState, useEffect } from 'react';
import styles from '<div className="" />
<Model></Model>.module.css';
import { WasteManagementRequest, Recycler } from '@/types';

interface UserFormProps {
  type: 'request' | 'recycler';
  initialData?: WasteManagementRequest | Recycler;
  onSubmit: (data: any) => void;
  onClose?: () => void;
}

const UserForm: React.FC<UserFormProps> = ({ type, initialData, onSubmit, onClose }) => {
  const [formData, setFormData] = useState<Partial<WasteManagementRequest & Recycler>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        ...(initialData as Recycler).wasteManagementInfo
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'recycler') {
      const { CompanyName, location, employees, ...recyclerData } = formData;
      onSubmit({
        ...recyclerData,
        wasteManagementInfo: {
          CompanyName,
          location,
          employees,
          WMSTYPE: formData.WMSTYPE || 'Recycle',
          detailsComp: true
        }
      });
    } else {
      onSubmit(formData);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2>{initialData ? 'Edit' : 'Add New'} {type === 'recycler' ? 'Recycler' : 'Request'}</h2>
      <form onSubmit={handleSubmit}>
        {type === 'request' ? (
          <>
            <div className={styles.formGroup}>
              <label>Client Name</label>
              <input
                type="text"
                name="client_name"
                value={formData.client_name || ''}
                onChange={handleChange}
                required
              />
            </div>
            {/* Add other request fields similarly */}
          </>
        ) : (
          <>
            <div className={styles.formGroup}>
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName || ''}
                onChange={handleChange}
                required
              />
            </div>
            {/* Add other recycler fields similarly */}
          </>
        )}
        <div className={styles.formActions}>
          {onClose && (
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
          )}
          <button type="submit" className={styles.submitButton}>
            {initialData ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;