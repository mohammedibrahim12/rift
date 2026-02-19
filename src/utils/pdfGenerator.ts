/**
 * PDF Certificate Generator
 * Generates professional PDF certificates using PDFKit
 */

import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';

export interface CertificateData {
  credentialId: string;
  studentName: string;
  courseName: string;
  studentType?: string | null;
  institutionName: string;
  issueDate: Date | string;
  certificateHash: string;
  status: string;
}

/**
 * Generate a PDF certificate and return as buffer
 */
export async function generateCertificatePDF(certificate: CertificateData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Background
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f9fa');
      
      // Border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
         .lineWidth(3)
         .stroke('#1a365d');
      
      // Inner border
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
         .lineWidth(1)
         .stroke('#2d3748');

      // Header - Institution Name
      doc.fontSize(28)
         .font('Helvetica-Bold')
         .fillColor('#1a365d')
         .text(certificate.institutionName.toUpperCase(), 0, 80, {
           align: 'center'
         });

      // Certificate Title
      doc.moveDown(0.5);
      doc.fontSize(18)
         .font('Helvetica')
         .fillColor('#4a5568')
         .text('CERTIFICATE OF COMPLETION', { align: 'center' });

      // Decorative line
      doc.moveDown(0.5);
      doc.moveTo(200, 180).lineTo(604, 180).lineWidth(2).stroke('#d69e2e');
      doc.moveDown(0.3);

      // "This is to certify that"
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#4a5568')
         .text('This is to certify that', { align: 'center' });

      // Student Name
      doc.moveDown(0.3);
      doc.fontSize(32)
         .font('Helvetica-Bold')
         .fillColor('#1a365d')
         .text(certificate.studentName, { align: 'center' });

      // Decorative line under name
      doc.moveDown(0.3);
      doc.moveTo(280, 270).lineTo(524, 270).lineWidth(1).stroke('#d69e2e');

      // "has successfully completed"
      doc.moveDown(0.5);
      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#4a5568')
         .text('has successfully completed the course', { align: 'center' });

      // Course Name
      doc.moveDown(0.3);
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .fillColor('#2d3748')
         .text(certificate.courseName, { align: 'center' });

      // Student Type (if available)
      if (certificate.studentType) {
        doc.moveDown(0.3);
        doc.fontSize(12)
           .font('Helvetica-Oblique')
           .fillColor('#718096')
           .text(`(${certificate.studentType})`, { align: 'center' });
      }

      // Issue Date
      const issueDate = new Date(certificate.issueDate);
      const formattedDate = issueDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.moveDown(1);
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#4a5568')
         .text(`Issued on: ${formattedDate}`, { align: 'center' });

      // Credential ID
      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#718096')
         .text(`Credential ID: ${certificate.credentialId}`, { align: 'center' });

      // Certificate Hash (truncated)
      const shortHash = certificate.certificateHash.substring(0, 32) + '...';
      doc.moveDown(0.2);
      doc.fontSize(8)
         .font('Helvetica')
         .fillColor('#a0aec0')
         .text(`Certificate Hash: ${shortHash}`, { align: 'center' });

      // Status Badge
      const statusY = 400;
      const statusColor = certificate.status === 'ACTIVE' ? '#38a169' : '#e53e3e';
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor(statusColor)
         .text(certificate.status, 0, statusY, { align: 'center' });

      // Footer - Verification info
      doc.moveDown(2);
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#718096')
         .text('This certificate can be verified at the Certificate Verification System', { align: 'center' });
      
      doc.moveDown(0.3);
      doc.fontSize(8)
         .fillColor('#a0aec0')
         .text('Powered by Algorand Blockchain Technology', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Save PDF certificate to file
 */
export async function saveCertificatePDF(
  certificate: CertificateData, 
  outputPath: string
): Promise<string> {
  const pdfBuffer = await generateCertificatePDF(certificate);
  
  // Ensure directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, pdfBuffer);
  return outputPath;
}
