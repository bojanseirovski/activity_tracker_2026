import { EmailService, EmailMessage } from './types';
const { MailerSend, EmailParams, Sender, Recipient } = require('mailersend');

export class MailerSendService implements EmailService {
    private client = new MailerSend({ apiKey: process.env.MAILERSEND_API_KEY || '' });
    private from = process.env.MAILERSEND_FROM_EMAIL || 'noreply@example.com';

    async send(msg: EmailMessage): Promise<void> {
        const params = new EmailParams()
            .setFrom(new Sender(this.from, 'ActivityTracker'))
            .setTo([new Recipient(msg.to, msg.toName)])
            .setSubject(msg.subject)
            .setHtml(msg.html)
            .setText(msg.text);
        await this.client.email.send(params);
    }
}
