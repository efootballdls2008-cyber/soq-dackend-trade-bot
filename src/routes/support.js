/**
 * Support Route
 * POST /support — authenticated user submits a support message
 * The message triggers:
 *   1. A custom HTML email to the admin (via emailService)
 *   2. An in-app admin notification (via notificationService)
 */
const express = require('express');
const { body } = require('express-validator');
const pool = require('../db/pool');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

const router = express.Router();
router.use(authenticate);

const SUBJECT_OPTIONS = [
  'Account Issue',
  'Deposit / Withdrawal',
  'Trading Problem',
  'KYC Verification',
  'Technical Issue',
  'Billing',
  'Other',
];

// POST /support
router.post(
  '/',
  [
    body('subject')
      .trim()
      .notEmpty().withMessage('Subject is required')
      .isIn(SUBJECT_OPTIONS).withMessage('Invalid subject category'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { subject, message, priority = 'medium' } = req.body;

      // Fetch user info for the email
      const [[user]] = await pool.query(
        'SELECT id, email, first_name, last_name FROM users WHERE id = ?',
        [userId]
      );
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const ticketRef = `SUP-${Date.now()}-${userId}`;
      const fullName  = `${user.first_name} ${user.last_name}`.trim();
      const submitted = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

      // ── 1. Send HTML email to admin ──────────────────────────
      emailService.sendSupportRequestEmail({
        userId,
        ticketRef,
        subject,
        message,
        priority,
        fullName,
        email: user.email,
        submitted,
      }).catch(err => console.error('[Support] Email error:', err.message));

      // ── 2. Admin in-app notification (real-time via socket) ──
      const priorityLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
      notificationService.createAdminNotification({
        title: `Support Request — ${subject}`,
        message: `${fullName} (${user.email}) submitted a ${priorityLabel} priority support request: "${message.slice(0, 120)}${message.length > 120 ? '…' : ''}"`,
        type: 'support_request',
        priority,
        relatedId: userId,
        relatedType: 'support',
        userId,
        metadata: { ticketRef, subject, priority, userName: fullName, userEmail: user.email },
      }).catch(err => console.error('[Support] Admin notification error:', err.message));

      // ── 3. User in-app confirmation notification ─────────────
      notificationService.createUserNotification({
        userId,
        title: 'Support Request Submitted',
        message: `Your support request "${subject}" has been received. Our team will respond within 24 hours. Reference: ${ticketRef}`,
        type: 'system',
        category: 'system_alerts',
        priority: 'low',
        relatedType: 'support',
        metadata: { ticketRef, subject },
      }).catch(err => console.error('[Support] User notification error:', err.message));

      res.json({
        success: true,
        message: 'Your support request has been submitted successfully.',
        ticketRef,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
