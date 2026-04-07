import { EmailService } from './types';
import { MailerSendService } from './mailersend';
import { SmtpService } from './smtp';

const provider = (process.env.EMAIL_PROVIDER || 'mailersend').toLowerCase();

export const emailService: EmailService =
    provider === 'smtp' ? new SmtpService() : new MailerSendService();

export type { EmailService, EmailMessage } from './types';
