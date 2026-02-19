/**
 * Certificate hash generation utilities
 * Uses SHA-256 for creating immutable certificate hashes
 */

import * as CryptoJS from 'crypto-js';
import { Certificate, CertificateInput } from '../types';

/**
 * Generate SHA-256 hash from certificate data
 * The hash serves as a unique fingerprint for the certificate
 */
export function generateCertificateHash(certificate: CertificateInput): string {
  // Sort keys to ensure consistent hashing
  const data = {
    studentName: certificate.studentName,
    institutionName: certificate.institutionName,
    courseName: certificate.courseName,
    issueDate: certificate.issueDate,
    expiryDate: certificate.expiryDate || '',
    metadata: certificate.metadata || {}
  };
  
  const sortedJson = JSON.stringify(data, Object.keys(data).sort());
  const hash = CryptoJS.SHA256(sortedJson).toString(CryptoJS.enc.Hex);
  
  return hash;
}

/**
 * Generate a unique credential ID
 * Format: CERT-{TIMESTAMP}-{RANDOM}
 */
export function generateCredentialId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `CERT-${timestamp}-${random}`.toUpperCase();
}

/**
 * Verify that a certificate matches the given hash
 */
export function verifyCertificateHash(
  certificate: CertificateInput,
  expectedHash: string
): boolean {
  const actualHash = generateCertificateHash(certificate);
  return actualHash === expectedHash;
}

/**
 * Create certificate object with generated ID and hash
 */
export function createCertificateObject(
  input: CertificateInput,
  studentId: string,
  institutionId: string
): Certificate {
  const credentialId = generateCredentialId();
  const certificateHash = generateCertificateHash(input);
  
  return {
    id: credentialId,
    credentialId,
    studentName: input.studentName,
    institutionName: input.institutionName,
    courseName: input.courseName,
    issueDate: input.issueDate,
    expiryDate: input.expiryDate,
    metadata: input.metadata || {}
  };
}

/**
 * Convert certificate to JSON for storage
 */
export function certificateToJson(certificate: Certificate): string {
  return JSON.stringify(certificate, Object.keys(certificate).sort());
}

/**
 * Parse certificate from JSON
 */
export function certificateFromJson(json: string): Certificate {
  return JSON.parse(json);
}

/**
 * Generate hash for Algorand asset (smaller format)
 * Uses first 8 characters of SHA-256 hash converted to integer
 */
export function generateAssetHash(certificateHash: string): number {
  const hexPart = certificateHash.substring(0, 8);
  return parseInt(hexPart, 16);
}
