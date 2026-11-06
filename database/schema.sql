-- Blood Bank Management System (ACADEMIC DEMONSTRATION - fictional data only)
-- Requires MySQL 8.0.16+ (CHECK constraints are enforced from that version)
CREATE DATABASE IF NOT EXISTS bloodbank_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bloodbank_db;

SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS notifications, admin_logs, contact_messages, blood_issues, blood_requests,
  inventory_transactions, blood_inventory, donations, donors, users;
SET FOREIGN_KEY_CHECKS=1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  mobile VARCHAR(10) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,          -- bcrypt hash, never plaintext
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_mobile CHECK (mobile REGEXP '^[6-9][0-9]{9}$')
);

CREATE TABLE donors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  date_of_birth DATE NOT NULL,
  gender ENUM('Male','Female','Other','Prefer not to say') NULL,
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  city VARCHAR(80) NOT NULL,
  location VARCHAR(150) NULL,
  last_donation_date DATE NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  consent_given BOOLEAN NOT NULL,
  consent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_consent CHECK (consent_given = TRUE),
  INDEX idx_donor_search (blood_group, city, is_available)
);
-- Name, email and mobile come from the linked users row (no duplicated personal data).
-- Medical eligibility is NOT decided by this system; staff assess it at the donation visit.

CREATE TABLE donations (          -- appointment requests AND completed collections
  id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id INT NOT NULL,
  preferred_date DATE NOT NULL,
  status ENUM('Requested','Scheduled','Completed','Deferred','Cancelled') NOT NULL DEFAULT 'Requested',
  collected_on DATE NULL,
  units INT NULL,
  staff_notes VARCHAR(500) NULL,
  recorded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_don_units CHECK (units IS NULL OR units BETWEEN 1 AND 2),
  INDEX idx_don_status (status, preferred_date)
);

CREATE TABLE blood_inventory (    -- one row per batch
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_code VARCHAR(30) NOT NULL UNIQUE,
  donation_id INT NULL,           -- traceability back to the collection
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  component ENUM('Whole Blood','Red Cells','Plasma','Platelets') NOT NULL,
  units_total INT NOT NULL,
  units_available INT NOT NULL,
  units_reserved INT NOT NULL DEFAULT 0,
  collection_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  screening_status ENUM('Pending','Passed','Failed') NOT NULL DEFAULT 'Pending',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_inv_nonneg CHECK (units_total > 0 AND units_available >= 0 AND units_reserved >= 0),
  CONSTRAINT chk_inv_sum CHECK (units_available + units_reserved <= units_total),
  CONSTRAINT chk_inv_dates CHECK (expiry_date > collection_date),
  INDEX idx_inv_lookup (blood_group, component, screening_status, expiry_date)
);
-- "Available" to the public = screening_status='Passed' AND expiry_date >= CURDATE() AND units_available>0.
-- The API always applies that rule; unscreened, expired or failed stock is never shown as available.

CREATE TABLE inventory_transactions (   -- audit trail of every stock change
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventory_id INT NOT NULL,
  change_type ENUM('Added','Screening Update','Reserved','Released','Issued','Adjustment','Expired Write-off') NOT NULL,
  units_change INT NOT NULL,
  note VARCHAR(255) NULL,
  performed_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES blood_inventory(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE blood_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(20) NOT NULL UNIQUE,      -- e.g. BR-2026-000123
  user_id INT NOT NULL,
  patient_name VARCHAR(100) NOT NULL,
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  component ENUM('Whole Blood','Red Cells','Plasma','Platelets') NOT NULL,
  units_required INT NOT NULL,
  hospital_name VARCHAR(150) NOT NULL,
  city VARCHAR(80) NOT NULL,
  urgency ENUM('Routine','Urgent','Emergency') NOT NULL DEFAULT 'Routine',
  contact_mobile VARCHAR(10) NOT NULL,
  notes VARCHAR(500) NULL,
  status ENUM('Pending','Under Review','Approved','Rejected','Ready for Issue','Issued','Cancelled') NOT NULL DEFAULT 'Pending',
  rejection_reason VARCHAR(300) NULL,
  admin_response VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_req_units CHECK (units_required BETWEEN 1 AND 10),
  CONSTRAINT chk_req_mobile CHECK (contact_mobile REGEXP '^[6-9][0-9]{9}$'),
  INDEX idx_req_filter (status, urgency, blood_group, created_at)
);
-- Allowed status moves (enforced in the controller):
-- Pending->Under Review|Cancelled; Under Review->Approved|Rejected|Cancelled;
-- Approved->Ready for Issue|Cancelled; Ready for Issue->Issued|Cancelled. Rejected/Issued/Cancelled are final.

CREATE TABLE blood_issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  inventory_id INT NOT NULL,
  units_issued INT NOT NULL,
  issued_by INT NOT NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES blood_requests(id),
  FOREIGN KEY (inventory_id) REFERENCES blood_inventory(id),
  FOREIGN KEY (issued_by) REFERENCES users(id),
  CONSTRAINT chk_issue_units CHECK (units_issued > 0)
);

CREATE TABLE contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(150) NOT NULL,
  message VARCHAR(2000) NOT NULL,
  status ENUM('New','In Progress','Resolved') NOT NULL DEFAULT 'New',
  admin_notes VARCHAR(1000) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(300) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notif_user (user_id, is_read)
);

CREATE TABLE admin_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id INT NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_log_time (created_at)
);
-- No payments table: this project does not sell blood (see README).
-- Sample data: run "npm run seed" in backend/ (users need bcrypt hashes).
