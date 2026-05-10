// components/UserForm.tsx
"use client";

import { useState, useEffect } from "react";
import styles from "./UserForm.module.css";

interface WasteManagementInfo {
  CompanyName?: string;
  RecycleType?: string;
  location?: string;
  employees?: string;
  ghMobileNumber?: string;
  ghanaCardNumber?: string;
  gps?: string;
  landmark?: string;
  WasteCategory?: string;
  WasteClassification?: string;
}

interface FormData {
  // Common fields
  firstName: string;
  LastName: string;
  email: string;
  phoneNumber: string;
  location: string;
  
  // Client specific
  SettlementType: string;
  gpsAddress: string;
  ghCardNo: string;
  dateOfBirth: string;
  
  // Recycler specific
  WMSTYPE: string;
  WMSCATEGORY: string;
  Password?: string;
  wasteManagementInfo: WasteManagementInfo;
}

// Flexible type for initial data to match Firebase structure
interface UserFormProps {
  type: "client" | "recycler";
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
}

// Helper to safely get nested values
const getNestedValue = (obj: Record<string, unknown>, path: string): string => {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return '';
    }
  }
  return typeof current === 'string' ? current : '';
};

export default function UserForm({ type, initialData, onSubmit, onCancel }: UserFormProps) {
  const [formData, setFormData] = useState<FormData>({
    // Common fields
    firstName: "",
    LastName: "",
    email: "",
    phoneNumber: "",
    location: "",
    
    // Client specific
    SettlementType: "",
    gpsAddress: "",
    ghCardNo: "",
    dateOfBirth: "",
    
    // Recycler specific
    WMSTYPE: "",
    WMSCATEGORY: "",
    Password: "",
    wasteManagementInfo: {
      CompanyName: "",
      RecycleType: "",
      location: "",
      employees: "",
      ghMobileNumber: "",
      ghanaCardNumber: "",
      gps: "",
      landmark: "",
      WasteCategory: "",
      WasteClassification: "",
    }
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        firstName: (initialData.firstName as string) || (initialData.FirstName as string) || "",
        LastName: (initialData.LastName as string) || "",
        email: (initialData.email as string) || "",
        phoneNumber: (initialData.phoneNumber as string) || (initialData.phone as string) || "",
        location: (initialData.location as string) || "",
        SettlementType: (initialData.SettlementType as string) || "",
        gpsAddress: (initialData.gpsAddress as string) || "",
        ghCardNo: (initialData.ghCardNo as string) || "",
        dateOfBirth: (initialData.dateOfBirth as string) || "",
        WMSTYPE: (initialData.WMSTYPE as string) || "",
        WMSCATEGORY: (initialData.WMSCATEGORY as string) || (initialData.wmsCategory as string) || "",
        Password: "",
        wasteManagementInfo: {
          CompanyName: getNestedValue(initialData, 'wasteManagementInfo.CompanyName'),
          RecycleType: getNestedValue(initialData, 'wasteManagementInfo.RecycleType'),
          location: getNestedValue(initialData, 'wasteManagementInfo.location'),
          employees: getNestedValue(initialData, 'wasteManagementInfo.employees'),
          ghMobileNumber: getNestedValue(initialData, 'wasteManagementInfo.ghMobileNumber'),
          ghanaCardNumber: getNestedValue(initialData, 'wasteManagementInfo.ghanaCardNumber'),
          gps: getNestedValue(initialData, 'wasteManagementInfo.gps'),
          landmark: getNestedValue(initialData, 'wasteManagementInfo.landmark'),
          WasteCategory: getNestedValue(initialData, 'wasteManagementInfo.WasteCategory'),
          WasteClassification: getNestedValue(initialData, 'wasteManagementInfo.WasteClassification'),
        }
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof FormData] as WasteManagementInfo),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData: Record<string, unknown> = {
      firstName: formData.firstName,
      LastName: formData.LastName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      location: formData.location,
    };
    
    // Add client-specific fields
    if (type === "client") {
      if (formData.SettlementType) submitData.SettlementType = formData.SettlementType;
      if (formData.gpsAddress) submitData.gpsAddress = formData.gpsAddress;
      if (formData.ghCardNo) submitData.ghCardNo = formData.ghCardNo;
      if (formData.dateOfBirth) submitData.dateOfBirth = formData.dateOfBirth;
    }
    
    // Add recycler-specific fields
    if (type === "recycler") {
      if (formData.WMSTYPE) submitData.WMSTYPE = formData.WMSTYPE;
      if (formData.WMSCATEGORY) submitData.WMSCATEGORY = formData.WMSCATEGORY;
      if (formData.Password) submitData.Password = formData.Password;
      
      // Add waste management info if any field is filled
      const wasteManagementInfo: Record<string, unknown> = {};
      let hasWasteManagementInfo = false;
      
      if (formData.wasteManagementInfo.CompanyName && formData.wasteManagementInfo.CompanyName.trim()) {
        wasteManagementInfo.CompanyName = formData.wasteManagementInfo.CompanyName;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.RecycleType && formData.wasteManagementInfo.RecycleType.trim()) {
        wasteManagementInfo.RecycleType = formData.wasteManagementInfo.RecycleType;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.location && formData.wasteManagementInfo.location.trim()) {
        wasteManagementInfo.location = formData.wasteManagementInfo.location;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.employees && formData.wasteManagementInfo.employees.trim()) {
        wasteManagementInfo.employees = formData.wasteManagementInfo.employees;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.ghMobileNumber && formData.wasteManagementInfo.ghMobileNumber.trim()) {
        wasteManagementInfo.ghMobileNumber = formData.wasteManagementInfo.ghMobileNumber;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.ghanaCardNumber && formData.wasteManagementInfo.ghanaCardNumber.trim()) {
        wasteManagementInfo.ghanaCardNumber = formData.wasteManagementInfo.ghanaCardNumber;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.gps && formData.wasteManagementInfo.gps.trim()) {
        wasteManagementInfo.gps = formData.wasteManagementInfo.gps;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.landmark && formData.wasteManagementInfo.landmark.trim()) {
        wasteManagementInfo.landmark = formData.wasteManagementInfo.landmark;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.WasteCategory && formData.wasteManagementInfo.WasteCategory.trim()) {
        wasteManagementInfo.WasteCategory = formData.wasteManagementInfo.WasteCategory;
        hasWasteManagementInfo = true;
      }
      if (formData.wasteManagementInfo.WasteClassification && formData.wasteManagementInfo.WasteClassification.trim()) {
        wasteManagementInfo.WasteClassification = formData.wasteManagementInfo.WasteClassification;
        hasWasteManagementInfo = true;
      }
      
      if (hasWasteManagementInfo) {
        submitData.wasteManagementInfo = wasteManagementInfo;
      }
    }
    
    // Remove empty fields
    Object.keys(submitData).forEach(key => {
      if (submitData[key] === "" || submitData[key] === undefined || submitData[key] === null) {
        delete submitData[key];
      }
    });
    
    onSubmit(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>
        {initialData ? "Edit" : "Add"} {type === "client" ? "Client" : "Recycler"}
      </h2>

      <div className={styles.formGrid}>
        {/* Personal Information */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Personal Information</h3>
          
          <div className={styles.fieldGroup}>
            <label className={styles.label}>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter first name"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Last Name *</label>
            <input
              type="text"
              name="LastName"
              value={formData.LastName}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter last name"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter email address"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Phone Number *</label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              required
              className={styles.input}
              placeholder="Enter phone number (e.g., 024XXXXXXX)"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Location</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter location"
            />
          </div>
        </div>

        {/* Client Specific Fields */}
        {type === "client" && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Client Details</h3>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Settlement Type</label>
              <select
                name="SettlementType"
                value={formData.SettlementType}
                onChange={handleChange}
                className={styles.select}
              >
                <option value="">Select Type</option>
                <option value="Household">Household</option>
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Organizational">Organizational</option>
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>GPS Address</label>
              <input
                type="text"
                name="gpsAddress"
                value={formData.gpsAddress}
                onChange={handleChange}
                className={styles.input}
                placeholder="Enter GPS address"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Ghana Card Number</label>
              <input
                type="text"
                name="ghCardNo"
                value={formData.ghCardNo}
                onChange={handleChange}
                className={styles.input}
                placeholder="Enter Ghana card number"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Date of Birth</label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className={styles.input}
              />
            </div>
          </div>
        )}

        {/* Recycler Specific Fields */}
        {type === "recycler" && (
          <>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Recycler Information</h3>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>WMS Type</label>
                <select
                  name="WMSTYPE"
                  value={formData.WMSTYPE}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="">Select Type</option>
                  <option value="Recycle">Recycle</option>
                  <option value="WMS">WMS</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Category</label>
                <select
                  name="WMSCATEGORY"
                  value={formData.WMSCATEGORY}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="">Select Category</option>
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                  <option value="Tertiary">Tertiary</option>
                </select>
              </div>

              {!initialData && (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Password</label>
                  <input
                    type="password"
                    name="Password"
                    value={formData.Password || ""}
                    onChange={handleChange}
                    className={styles.input}
                    placeholder="Enter password (optional)"
                  />
                </div>
              )}
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Company Information</h3>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Company Name</label>
                <input
                  type="text"
                  name="wasteManagementInfo.CompanyName"
                  value={formData.wasteManagementInfo.CompanyName}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Enter company name"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Recycle Type</label>
                <select
                  name="wasteManagementInfo.RecycleType"
                  value={formData.wasteManagementInfo.RecycleType}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="">Select Recycle Type</option>
                  <option value="Primary">Primary</option>
                  <option value="Secondary">Secondary</option>
                  <option value="Tertiary">Tertiary</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Company Location</label>
                <input
                  type="text"
                  name="wasteManagementInfo.location"
                  value={formData.wasteManagementInfo.location}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Enter company location"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Number of Employees</label>
                <input
                  type="text"
                  name="wasteManagementInfo.employees"
                  value={formData.wasteManagementInfo.employees}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Enter number of employees"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Company Phone</label>
                <input
                  type="tel"
                  name="wasteManagementInfo.ghMobileNumber"
                  value={formData.wasteManagementInfo.ghMobileNumber}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Enter company phone"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Company Ghana Card</label>
                <input
                  type="text"
                  name="wasteManagementInfo.ghanaCardNumber"
                  value={formData.wasteManagementInfo.ghanaCardNumber}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Enter company Ghana card"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>GPS Address</label>
                <input
                  type="text"
                  name="wasteManagementInfo.gps"
                  value={formData.wasteManagementInfo.gps}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Enter GPS address"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Landmark</label>
                <input
                  type="text"
                  name="wasteManagementInfo.landmark"
                  value={formData.wasteManagementInfo.landmark}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Enter landmark"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Waste Category</label>
                <select
                  name="wasteManagementInfo.WasteCategory"
                  value={formData.wasteManagementInfo.WasteCategory}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="">Select Waste Category</option>
                  <option value="Plastic">Plastic</option>
                  <option value="Glass">Glass</option>
                  <option value="Metal">Metal</option>
                  <option value="Paper">Paper</option>
                  <option value="Organic">Organic</option>
                  <option value="Electronic">Electronic</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Waste Classification</label>
                <select
                  name="wasteManagementInfo.WasteClassification"
                  value={formData.wasteManagementInfo.WasteClassification}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="">Select Waste Classification</option>
                  <option value="G1 - Not Clean">G1 - Not Clean (From dump sites)</option>
                  <option value="G2 - Partially Clean">G2 - Partially Clean (From streets)</option>
                  <option value="G3 - Very Clean">G3 - Very Clean (From homes/orgs)</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} className={styles.cancelButton}>
          Cancel
        </button>
        <button type="submit" className={styles.submitButton}>
          {initialData ? "Update" : "Create"}
        </button>
      </div>
    </form>
  );
}