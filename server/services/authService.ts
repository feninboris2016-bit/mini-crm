import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { usersRepository, User } from '../repositories/usersRepository.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-development-only-change-in-prod';
const TOKEN_EXPIRY = '7d';

// In-memory failed login tracking for brute-force rate limiting
interface FailedLoginAttempt {
  count: number;
  blockedUntil: number;
}
const failedAttemptsMap = new Map<string, FailedLoginAttempt>();

export const authService = {
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  },

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  generateToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );
  },

  verifyToken(token: string): { userId: string; email: string; role: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      };
    } catch {
      return null;
    }
  },

  checkBruteForce(ipOrEmail: string): { blocked: boolean; waitSeconds?: number } {
    const key = ipOrEmail.toLowerCase().trim();
    const entry = failedAttemptsMap.get(key);
    if (!entry) return { blocked: false };

    const now = Date.now();
    if (entry.blockedUntil > now) {
      const waitSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      return { blocked: true, waitSeconds };
    }

    if (entry.blockedUntil <= now && entry.count >= 5) {
      // Reset after block window passed
      failedAttemptsMap.delete(key);
    }

    return { blocked: false };
  },

  recordFailedLogin(ipOrEmail: string): void {
    const key = ipOrEmail.toLowerCase().trim();
    const now = Date.now();
    const entry = failedAttemptsMap.get(key) || { count: 0, blockedUntil: 0 };
    entry.count += 1;

    // If 5 failed attempts, block for 5 minutes; if 10, block for 30 minutes
    if (entry.count >= 10) {
      entry.blockedUntil = now + 30 * 60 * 1000;
    } else if (entry.count >= 5) {
      entry.blockedUntil = now + 5 * 60 * 1000;
    }

    failedAttemptsMap.set(key, entry);
  },

  recordSuccessfulLogin(ipOrEmail: string): void {
    const key = ipOrEmail.toLowerCase().trim();
    failedAttemptsMap.delete(key);
  }
};
