import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignatureHelper {
  private readonly logger = new Logger(WebhookSignatureHelper.name);

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
  ): boolean {
    try {
      const expectedSignature = this.generateSignature(
        payload,
        secret,
        algorithm,
      );
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error(`Signature verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Generate signature for verification
   */
  private generateSignature(
    payload: string,
    secret: string,
    algorithm: string = 'sha256',
  ): string {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Verify timestamp freshness (prevent replay attacks)
   */
  verifyTimestamp(timestamp: string, maxAgeMinutes: number = 5): boolean {
    try {
      const timestampNum = parseInt(timestamp, 10);
      if (isNaN(timestampNum)) {
        return false;
      }

      const timestampDate = new Date(timestampNum * 1000); // Convert to milliseconds
      const now = new Date();
      const maxAgeMs = maxAgeMinutes * 60 * 1000;

      return Math.abs(now.getTime() - timestampDate.getTime()) <= maxAgeMs;
    } catch (error) {
      this.logger.error(`Timestamp verification failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate VietQR webhook signature
   */
  verifyVietQRWebhook(
    payload: string,
    headers: {
      'x-signature'?: string;
      'x-timestamp'?: string;
      'x-nonce'?: string;
    },
  ): boolean {
    const signature = headers['x-signature'];
    const timestamp = headers['x-timestamp'];

    if (!signature || !timestamp) {
      this.logger.warn('Missing required webhook headers');
      return false;
    }

    // Get secret from environment
    const secret = process.env.VIETQR_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error('VIETQR_WEBHOOK_SECRET not configured');
      return false;
    }

    // Verify timestamp freshness
    if (!this.verifyTimestamp(timestamp)) {
      this.logger.warn('Webhook timestamp is too old or invalid');
      return false;
    }

    // Verify signature
    return this.verifySignature(payload, signature, secret);
  }

  /**
   * Extract signature from header (handle different formats)
   */
  extractSignature(header: string): string {
    // Handle formats like "sha256=abc123" or just "abc123"
    if (header.includes('=')) {
      return header.split('=')[1];
    }
    return header;
  }

  /**
   * Validate webhook headers
   */
  validateWebhookHeaders(headers: any): {
    signature: string;
    timestamp: string;
    nonce?: string;
  } {
    const signature = headers['x-signature'] || headers['x-signature'];
    const timestamp = headers['x-timestamp'] || headers['x-timestamp'];
    const nonce = headers['x-nonce'] || headers['x-nonce'];

    if (!signature) {
      throw new BadRequestException('Missing x-signature header');
    }

    if (!timestamp) {
      throw new BadRequestException('Missing x-timestamp header');
    }

    return {
      signature: this.extractSignature(signature),
      timestamp,
      nonce,
    };
  }
}
