import { EmailService, EmailMessage } from './types';
import nodemailer from 'nodemailer';

export class SmtpService implements EmailService {
    private transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
        },
    });
    private from = process.env.SMTP_FROM || process.env.SMTP_USER || '';

    async send(msg: EmailMessage): Promise<void> {
        await this.transporter.sendMail({
            from: `ActivityTracker <${this.from}>`,
            to: msg.toName ? `${msg.toName} <${msg.to}>` : msg.to,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
        });
    }
}
