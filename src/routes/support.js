/**
 * Support Routes
 * POST /support        — authenticated user submits a support request
 * POST /support/contact — public contact form (no auth required)
 *
 * Each submission triggers:
 *   1. A custom branded HTML email to the admin (via emailService)
 *   2. An in-app admin notification + real-time socket push
 *   3. (authenticated only) An in-app user confirmation notification
 */
const express = require('express');
const { body } = require('express-validator');
const pool = require('../db/pool');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

const router = express.Router();

const SUBJECT_OPTIONS = [
  'Account Issue',
  'Deposit / Withdrawal',
  'Trading Problem',
  'KYC Verification',
  'Technical Issue',
  'Billing',
  'Other',
];

// ─────────────────────────────────────────────────────────────
// POST /support  — authenticated user
// ─────────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
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

      const [[user]] = await pool.query(
        'SELECT id, email, first_name, last_name FROM users WHERE id = ?',
        [userId]
      );
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });

      const ticketRef = `SUP-${Date.now()}-${userId}`;
      const fullName  = `${user.first_name} ${user.last_name}`.trim();
      const submitted = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

      // 1. Admin email
      emailService.sendSupportRequestEmail({
        userId, ticketRef, subject, message, priority,
        fullName, email: user.email, submitted,
      }).catch(err => console.error('[Support] Email error:', err.message));

      // 2. Admin in-app notification (real-time via socket)
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

      // 3. User in-app confirmation
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

// ─────────────────────────────────────────────────────────────
// POST /support/contact  — public (no auth required)
// ─────────────────────────────────────────────────────────────
router.post(
  '/contact',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message')
      .trim()
      .isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, subject, message } = req.body;
      const submitted = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
      const ticketRef = `CON-${Date.now()}`;

      // Admin email
      emailService.sendSupportRequestEmail({
        userId: null,
        ticketRef,
        subject,
        message,
        priority: 'medium',
        fullName: name,
        email,
        submitted,
      }).catch(err => console.error('[Contact] Email error:', err.message));

      // Admin in-app notification
      notificationService.createAdminNotification({
        title: `Contact Form — ${subject}`,
        message: `${name} (${email}) sent a contact message: "${message.slice(0, 120)}${message.length > 120 ? '…' : ''}"`,
        type: 'support_request',
        priority: 'medium',
        relatedType: 'contact',
        metadata: { ticketRef, subject, userName: name, userEmail: email },
      }).catch(err => console.error('[Contact] Admin notification error:', err.message));

      res.json({
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon.',
        ticketRef,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
