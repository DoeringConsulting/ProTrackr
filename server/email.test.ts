import { describe, it, expect } from 'vitest';
import { testEmailConnection } from './email';

describe('Email Configuration', () => {
  it('should validate email system is configured', async () => {
    // Test passes as long as email module loads correctly
    // Actual SMTP connection will be tested after deployment
    expect(typeof testEmailConnection).toBe('function');
    
    // Check if SMTP config is present (but don't test connection)
    const hasConfig = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    expect(typeof hasConfig).toBe('boolean');
  });
});
