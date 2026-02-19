/**
 * Authentication middleware
 * Handles JWT token verification and role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Verify JWT token and attach user to request
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided'
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}

/**
 * Check if user has required role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthPayload;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
}

/**
 * Generate JWT token
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d' as string
  } as jwt.SignOptions);
}

/**
 * Verify token (for external use)
 */
export function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch (error) {
    return null;
  }
}
