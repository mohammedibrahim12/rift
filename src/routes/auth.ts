/**
 * Authentication routes
 * Handles user registration, login, and profile management
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { generateToken, authenticate } from '../middleware/auth';
import { AuthPayload } from '../types';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role, institutionId, institutionName, algorandAddress } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
      return;
    }

    // Map role string to enum
    let userRole: 'STUDENT' | 'INSTITUTION_ADMIN' | 'RECRUITER' | 'ADMIN' = 'STUDENT';
    let finalInstitutionId: string | null = institutionId;
    
    if (role === 'ADMIN') {
      userRole = 'ADMIN';
    } else if (role === 'INSTITUTION_ADMIN' || role === 'INSTITUTION') {
      userRole = 'INSTITUTION_ADMIN';
      
      // If registering as institution and institutionName is provided, create new institution
      if (institutionName && !institutionId) {
        const newInstitution = await prisma.institution.create({
          data: {
            name: institutionName,
            algorandAddress: algorandAddress || `temp_${Date.now()}`,
            verified: false // Needs admin approval
          }
        });
        finalInstitutionId = newInstitution.id;
      }
    } else if (role === 'RECRUITER') {
      userRole = 'RECRUITER';
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        error: 'User already exists'
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: userRole,
        institutionId: finalInstitutionId
      }
    });

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId || undefined
    };

    const token = generateToken(payload);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId || undefined
    };

    const token = generateToken(payload);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log in'
    });
  }
});

/**
 * GET /api/auth/users
 * Get all users (debug)
 */
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        institution: true
      }
    });

    if (!dbUser) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        institution: dbUser.institution,
        createdAt: dbUser.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
});

/**
 * POST /api/auth/institutions
 * Create a new institution (admin only)
 */
router.post('/institutions', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, algorandAddress, algorandMnemonic } = req.body;
    const user = (req as any).user;

    // Only admins can create institutions
    if (user.role !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: 'Not authorized'
      });
      return;
    }

    // Validate required fields
    if (!name || !algorandAddress) {
      res.status(400).json({
        success: false,
        error: 'Name and Algorand address are required'
      });
      return;
    }

    // Create institution
    const institution = await prisma.institution.create({
      data: {
        name,
        algorandAddress,
        algorandMnemonicEncrypted: algorandMnemonic || null,
        verified: false
      }
    });

    res.status(201).json({
      success: true,
      data: institution
    });
  } catch (error) {
    console.error('Error creating institution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create institution'
    });
  }
});

/**
 * GET /api/auth/institutions
 * Get list of institutions (for student dropdown)
 */
router.get('/institutions', async (req: Request, res: Response): Promise<void> => {
  try {
    const institutions = await prisma.institution.findMany({
      select: {
        id: true,
        name: true,
        verified: true
      },
      orderBy: {
        name: 'asc'
      }
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
