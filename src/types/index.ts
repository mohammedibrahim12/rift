/**
 * Certificate data model and related types
 */

export interface Certificate {
  id: string;
  studentName: string;
  institutionName: string;
  courseName: string;
  issueDate: string;
  expiryDate?: string;
  credentialId: string;
  metadata: CertificateMetadata;
}

export interface CertificateMetadata {
  major?: string;
  gpa?: number;
  duration?: string;
}

export interface CertificateInput {
  studentName: string;
  institutionName: string;
  courseName: string;
  issueDate: string;
  expiryDate?: string;
  metadata?: CertificateMetadata;
}

export interface VerifyRequest {
  certificateId?: string;
  certificateHash?: string;
  credentialId?: string;
}

export interface VerifyResponse {
  isValid: boolean;
  certificate?: {
    studentName: string;
    institutionName: string;
    courseName: string;
    issueDate: string;
    expiryDate?: string;
    credentialId: string;
  };
  transactionId: string;
  verifiedAt: string;
}

export interface IssueCertificateRequest {
  studentId: string;
  studentName: string;
  institutionId: string;
  institutionName: string;
  courseName: string;
  issueDate: string;
  expiryDate?: string;
  metadata?: CertificateMetadata;
}

export interface IssueCertificateResponse {
  certificateId: string;
  credentialId: string;
  certificateHash: string;
  algorandAssetId: number;
  algorandTxId: string;
  createdAt: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
  institutionId?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
