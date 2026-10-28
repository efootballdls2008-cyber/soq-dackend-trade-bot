/**
 * Support Routes
 * Handles user support messages that get emailed to admin
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/emailService');
const pool = require('../db/pool');

const router = express.Router();

/**
 * POST /support/message
 * Submit a support message (authenticated users)
 */
router.post(
  '/message',
  authenticate,
  [
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { subject, message } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    try {
      // Get user details
      const [users] = await pool.query(
        'SELECT first_name, last_name, email FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const user = users[0];
      const userName = `${user.first_name} ${user.last_name}`;

      // Save message to database
      await pool.query(
        `INSERT INTO support_messages (user_id, subject, message, status, created_at) 
         VALUES (?, ?, ?, 'pending', NOW())`,
        [userId, subject, message]
      );

      // Send email to admin
      const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_SEED_EMAIL || 'admin@schwab.local';
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #0d0824; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #a28539; margin: 0; font-size: 24px;">New Support Message</h1>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
              <p style="margin: 5px 0; color: #374151;"><strong>From:</strong> ${userName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${userEmail}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>User ID:</strong> ${userId}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Subject:</strong> ${subject}</p>
            </div>
            
            <div style="margin-top: 20px;">
              <p style="color: #6b7280; font-weight: bold; margin-bottom: 10px;">Message:</p>
              <div style="background-color: #f9fafb; padding: 15px; border-left: 4px solid #a28539; border-radius: 4px;">
                <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Reply directly to <a href="mailto:${userEmail}" style="color: #a28539; text-decoration: none;">${userEmail}</a> to respond to this message.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 5px 0;">Charles Schwab Trading Platform</p>
            <p style="margin: 5px 0;">Support Message System</p>
          </div>
        </div>
      `;

      const textContent = `
New Support Message

From: ${userName}
Email: ${userEmail}
User ID: ${userId}
Subject: ${subject}

Message:
${message}

---
Reply to ${userEmail} to respond to this message.

Charles Schwab Trading Platform
Support Message System
      `.trim();

      // Send email
      await emailService.sendEmail({
        to: adminEmail,
        subject: `Support: ${subject}`,
        html: htmlContent,
        text: textContent,
      });

      res.json({
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon.',
      });
    } catch (error) {
      console.error('[Support Error]', error);
      res.status(500).json({ success: false, message: 'Failed to send support message' });
    }
  }
);

/**
 * POST /support/contact
 * Submit a contact message (public - no auth required)
 */
router.post(
  '/contact',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { name, email, subject, message } = req.body;

    try {
      // Save message to database (user_id is null for guest messages)
      await pool.query(
        `INSERT INTO support_messages (user_id, name, email, subject, message, status, created_at) 
         VALUES (NULL, ?, ?, ?, ?, 'pending', NOW())`,
        [name, email, subject, message]
      );

      // Send email to admin
      const adminEmail = process.env.ADMIN_EMAIL || process.env.ADMIN_SEED_EMAIL || 'admin@schwab.local';
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #0d0824; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #a28539; margin: 0; font-size: 24px;">New Contact Message</h1>
            <p style="color: #9ca3af; margin: 10px 0 0 0; font-size: 14px;">From website visitor</p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
              <p style="margin: 5px 0; color: #374151;"><strong>From:</strong> ${name}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Subject:</strong> ${subject}</p>
            </div>
            
            <div style="margin-top: 20px;">
              <p style="color: #6b7280; font-weight: bold; margin-bottom: 10px;">Message:</p>
              <div style="background-color: #f9fafb; padding: 15px; border-left: 4px solid #a28539; border-radius: 4px;">
                <p style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${message}</p>
              </div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Reply directly to <a href="mailto:${email}" style="color: #a28539; text-decoration: none;">${email}</a> to respond to this message.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 5px 0;">Charles Schwab Trading Platform</p>
            <p style="margin: 5px 0;">Contact Form</p>
          </div>
        </div>
      `;

      const textContent = `
New Contact Message (Website Visitor)

From: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
Reply to ${email} to respond to this message.

Charles Schwab Trading Platform
Contact Form
      `.trim();

      // Send email
      await emailService.sendEmail({
        to: adminEmail,
        subject: `Contact: ${subject}`,
        html: htmlContent,
        text: textContent,
      });

      res.json({
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon.',
      });
    } catch (error) {
      console.error('[Contact Error]', error);
      res.status(500).json({ success: false, message: 'Failed to send contact message' });
    }
  }
);

module.exports = router;
