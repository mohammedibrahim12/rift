/**
 * Certificate routes
 * Handles certificate requests, issuance, and verification
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { authenticate } from '../middleware/auth';
import { AuthPayload } from '../types';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { generateCertificatePDF } from '../utils/pdfGenerator';
import { 
  createAlgodClient, 
  createIndexer,
  createCertificateAsset,
  generateAccountFromMnemonic,
  verifyCertificateOnChain
} from '../utils/algorand';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * POST /api/certificates/request
 * Student submits a certificate request
 */
router.post('/request', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;
    
    // Only students can submit requests
    if (user.role !== 'STUDENT') {
      res.status(403).json({
        success: false,
        error: 'Only students can submit certificate requests'
      });
      return;
    }

    const { institutionId, studentName, courseName, studentType } = req.body;

    // Validate required fields
    if (!institutionId || !studentName || !courseName || !studentType) {
      res.status(400).json({
        success: false,
        error: 'Institution ID, student name, course name, and student type are required'
      });
      return;
    }

    // Verify institution exists
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId }
    });

    if (!institution) {
      res.status(404).json({
        success: false,
        error: 'Institution not found'
      });
      return;
    }

    // Create certificate request
    const certificateRequest = await prisma.certificateRequest.create({
      data: {
        studentId: user.userId,
        institutionId,
        studentName,
        courseName,
        studentType: studentType || null,
        status: 'PENDING'
      }
    });

    res.status(201).json({
      success: true,
      data: certificateRequest
    });
  } catch (error) {
    console.error('Error creating certificate request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create certificate request'
    });
  }
});

/**
 * GET /api/certificates/my-requests
 * Student views their certificate requests
 */
router.get('/my-requests', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;

    const requests = await prisma.certificateRequest.findMany({
      where: { studentId: user.userId },
      include: {
        institution: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching certificate requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch certificate requests'
    });
  }
});

/**
 * GET /api/certificates/pending-requests
 * Institution views pending certificate requests
 */
router.get('/pending-requests', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;

    // Only institution admins can view pending requests
    if (user.role !== 'INSTITUTION_ADMIN' && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Not authorized to view pending requests'
      });
      return;
    }

    // Find institutions the user is associated with
    const userWithInstitutions = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { institution: true }
    });

    if (!userWithInstitutions?.institution) {
      res.status(400).json({
        success: false,
        error: 'User is not associated with an institution'
      });
      return;
    }

    const requests = await prisma.certificateRequest.findMany({
      where: { 
        institutionId: userWithInstitutions.institution.id,
        status: 'PENDING'
      },
      include: {
        student: {
          select: { id: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending requests'
    });
  }
});

/**
 * GET /api/certificates/issued-certificates
 * Get certificates issued by the institution
 */
router.get('/issued-certificates', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;

    // Only institution admins can view issued certificates
    if (user.role !== 'INSTITUTION_ADMIN' && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Not authorized to view issued certificates'
      });
      return;
    }

    // Find institutions the user is associated with
    const userWithInstitutions = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { institution: true }
    });

    if (!userWithInstitutions?.institution) {
      res.status(400).json({
        success: false,
        error: 'User is not associated with an institution'
      });
      return;
    }

    const certificates = await prisma.certificate.findMany({
      where: { 
        institutionId: userWithInstitutions.institution.id
      },
      include: {
        student: {
          select: { id: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: certificates
    });
  } catch (error) {
    console.error('Error fetching issued certificates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch issued certificates'
    });
  }
});

/**
 * POST /api/certificates/approve/:id
 * Institution approves a certificate request
 */
router.post('/approve/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;
    const requestId = req.params.id;

    // Only institution admins can approve requests
    if (user.role !== 'INSTITUTION_ADMIN' && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Not authorized to approve requests'
      });
      return;
    }

    // Find the certificate request
    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id: requestId },
      include: { institution: true }
    });

    if (!certificateRequest) {
      res.status(404).json({
        success: false,
        error: 'Certificate request not found'
      });
      return;
    }

    // Verify the user belongs to this institution
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { institution: true }
    });

    if (currentUser?.institution?.id !== certificateRequest.institutionId) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to approve this request'
      });
      return;
    }

    // Generate unique credential ID
    const credentialId = `CERT-${uuidv4().substring(0, 8).toUpperCase()}`;
    
    // Generate certificate hash
    const certificateData = {
      credentialId,
      studentName: certificateRequest.studentName,
      courseName: certificateRequest.courseName,
      institutionName: certificateRequest.institution.name,
      issueDate: new Date().toISOString(),
      requestId: certificateRequest.id
    };
    const certificateHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(certificateData))
      .digest('hex');

    // Initialize Algorand variables
    let algorandAssetId: bigint | null = null;
    let algorandTxId: string | null = null;

    // Try to create Algorand asset for the certificate
    try {
      const mnemonic = process.env.INSTITUTION_MNEMONIC;
      
      if (mnemonic) {
        console.log('Creating Algorand asset for certificate...');
        
        const client = createAlgodClient();
        const account = generateAccountFromMnemonic(mnemonic);
        
        const assetResult = await createCertificateAsset(
          client,
          account,
          credentialId,
          certificateHash,
          certificateData
        );
        
        algorandAssetId = BigInt(assetResult.assetId);
        algorandTxId = assetResult.transactionId;
        
        console.log(`Algorand asset created: ${algorandAssetId}, TxID: ${algorandTxId}`);
      } else {
        console.log('No INSTITUTION_MNEMONIC configured, skipping Algorand asset creation');
      }
    } catch (algorandError) {
      // Log error but don't fail the certificate creation
      console.error('Error creating Algorand asset:', algorandError);
      console.log('Certificate created without Algorand blockchain record');
    }

    // Update request status to approved
    await prisma.certificateRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' }
    });

    // Create the certificate with optional Algorand data
    const certificateDataToSave: any = {
      credentialId,
      studentId: certificateRequest.studentId,
      institutionId: certificateRequest.institutionId,
      studentName: certificateRequest.studentName,
      courseName: certificateRequest.courseName,
      issueDate: new Date(),
      certificateHash,
      certificateData,
      status: 'ACTIVE'
    };

    // Only add Algorand fields if they exist
    if (algorandAssetId !== null) {
      certificateDataToSave.algorandAssetId = algorandAssetId;
    }
    if (algorandTxId !== null) {
      certificateDataToSave.algorandTxId = algorandTxId;
    }

    const certificate = await prisma.certificate.create({
      data: certificateDataToSave
    });

    res.json({
      success: true,
      data: {
        certificate,
        blockchain: {
          assetId: algorandAssetId?.toString(),
          transactionId: algorandTxId,
          verified: !!algorandAssetId
        },
        message: algorandAssetId 
          ? 'Certificate approved and recorded on Algorand blockchain'
          : 'Certificate approved (blockchain recording skipped)'
      }
    });
  } catch (error) {
    console.error('Error approving certificate request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve certificate request'
    });
  }
});

/**
 * POST /api/certificates/reject/:id
 * Institution rejects a certificate request
 */
router.post('/reject/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;
    const requestId = req.params.id;
    const { reason } = req.body;

    // Only institution admins can reject requests
    if (user.role !== 'INSTITUTION_ADMIN' && user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Not authorized to reject requests'
      });
      return;
    }

    // Find the certificate request
    const certificateRequest = await prisma.certificateRequest.findUnique({
      where: { id: requestId }
    });

    if (!certificateRequest) {
      res.status(404).json({
        success: false,
        error: 'Certificate request not found'
      });
      return;
    }

    // Verify the user belongs to this institution
    const currentUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { institution: true }
    });

    if (currentUser?.institution?.id !== certificateRequest.institutionId) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to reject this request'
      });
      return;
    }

    // Update request status to rejected
    await prisma.certificateRequest.update({
      where: { id: requestId },
      data: { 
        status: 'REJECTED',
        rejectionReason: reason || 'Request rejected by institution'
      }
    });

    res.json({
      success: true,
      data: { message: 'Certificate request rejected' }
    });
  } catch (error) {
    console.error('Error rejecting certificate request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject certificate request'
    });
  }
});

/**
 * GET /api/certificates/my-certificates
 * Student views their issued certificates
 */
router.get('/my-certificates', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;

    const certificates = await prisma.certificate.findMany({
      where: { studentId: user.userId },
      include: {
        institution: {
          select: { id: true, name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: certificates
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch certificates'
    });
  }
});

/**
 * GET /api/certificates/download/:credentialId
 * Student downloads their certificate
 */
router.get('/download/:credentialId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;
    const { credentialId } = req.params;

    const certificate = await prisma.certificate.findFirst({
      where: { 
        credentialId,
        studentId: user.userId
      },
      include: {
        institution: {
          select: { name: true }
        }
      }
    });

    if (!certificate) {
      res.status(404).json({
        success: false,
        error: 'Certificate not found'
      });
      return;
    }

    // Generate certificate data for download
    const certificateDownload = {
      credentialId: certificate.credentialId,
      studentName: (certificate as any).studentName,
      courseName: (certificate as any).courseName,
      institutionName: certificate.institution.name,
      issueDate: (certificate as any).issueDate,
      status: certificate.status,
      certificateHash: certificate.certificateHash,
      verified: certificate.status === 'ACTIVE'
    };

    res.json({
      success: true,
      data: certificateDownload
    });
  } catch (error) {
    console.error('Error downloading certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download certificate'
    });
  }
});

/**
 * GET /api/certificates/download-pdf/:credentialId
 * Student downloads their certificate as PDF
 */
router.get('/download-pdf/:credentialId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user as AuthPayload;
    const { credentialId } = req.params;

    const certificate = await prisma.certificate.findFirst({
      where: { 
        credentialId,
        studentId: user.userId
      },
      select: {
        credentialId: true,
        studentName: true,
        courseName: true,
        studentType: true,
        issueDate: true,
        certificateHash: true,
        status: true,
        certificateData: true,
        institution: {
          select: { name: true }
        }
      }
    });

    if (!certificate) {
      res.status(404).json({
        success: false,
        error: 'Certificate not found'
      });
      return;
    }

    // Get certificate data from JSON field
    const certData = certificate.certificateData as {
      studentType?: string;
    };

    // Generate PDF
    const pdfBuffer = await generateCertificatePDF({
      credentialId: certificate.credentialId,
      studentName: certificate.studentName,
      courseName: certificate.courseName,
      studentType: certificate.studentType,
      institutionName: certificate.institution.name,
      issueDate: certificate.issueDate,
      certificateHash: certificate.certificateHash,
      status: certificate.status
    });

    // Send PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificate-${credentialId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF certificate'
    });
  }
});

/**
 * POST /api/certificates/verify
 * Recruiter verifies a certificate
 */
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { credentialId } = req.body;

    if (!credentialId) {
      res.status(400).json({
        success: false,
        error: 'Certificate ID is required'
      });
      return;
    }

    const certificate = await prisma.certificate.findUnique({
      where: { credentialId },
      include: {
        institution: {
          select: { name: true }
        }
      }
    });

    if (!certificate) {
      res.status(404).json({
        success: false,
        error: 'Certificate not found',
        data: { isValid: false }
      });
      return;
    }

    const isValid = certificate.status === 'ACTIVE';
    
    // Try to verify on Algorand blockchain if asset exists
    let blockchainVerified = false;
    let blockchainInfo = null;
    
    if (certificate.algorandAssetId) {
      try {
        const indexer = createIndexer();
        const result = await verifyCertificateOnChain(
          indexer,
          Number(certificate.algorandAssetId),
          certificate.certificateHash
        );
        blockchainVerified = result.isValid;
        blockchainInfo = {
          assetId: certificate.algorandAssetId.toString(),
          transactionId: certificate.algorandTxId,
          owner: result.owner,
          metadata: result.metadata
        };
      } catch (blockchainError) {
        console.error('Error verifying on blockchain:', blockchainError);
      }
    }

    res.json({
      success: true,
      data: {
        isValid,
        blockchainVerified,
        certificate: isValid ? {
          credentialId: certificate.credentialId,
          studentName: certificate.studentName,
          courseName: certificate.courseName,
          institutionName: certificate.institution.name,
          issueDate: certificate.issueDate,
          status: certificate.status,
          certificateHash: certificate.certificateHash,
          blockchain: blockchainInfo
        } : null,
        message: isValid 
          ? (blockchainVerified ? 'Certificate is valid and verified on Algorand blockchain' : 'Certificate is valid (blockchain verification pending)')
          : 'Certificate is not valid'
      }
    });
  } catch (error) {
    console.error('Error verifying certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify certificate'
    });
  }
});

/**
 * GET /api/certificates/verify/:credentialId
 * Public endpoint to verify certificate (GET method)
 */
router.get('/verify/:credentialId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { credentialId } = req.params;

    const certificate = await prisma.certificate.findUnique({
      where: { credentialId },
      include: {
        institution: {
          select: { name: true }
        }
      }
    });

    if (!certificate) {
      res.status(404).json({
        success: false,
        error: 'Certificate not found',
        data: { isValid: false }
      });
      return;
    }

    const isValid = certificate.status === 'ACTIVE';

    res.json({
      success: true,
      data: {
        isValid,
        certificate: isValid ? {
          credentialId: certificate.credentialId,
          studentName: certificate.studentName,
          courseName: certificate.courseName,
          institutionName: certificate.institution.name,
          issueDate: certificate.issueDate,
          status: certificate.status
        } : null
      }
    });
  } catch (error) {
    console.error('Error verifying certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify certificate'
    });
  }
});

/**
 * GET /api/certificates/institutions
 * Get list of institutions (for student to select)
 */
router.get('/institutions', async (req: Request, res: Response): Promise<void> => {
  try {
    // Show all institutions (verified and pending) so students can select
    const institutions = await prisma.institution.findMany({
      select: {
        id: true,
        name: true,
        verified: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: institutions
    });
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch institutions'
    });
  }
});

export default router;
