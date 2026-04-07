export interface EmailMessage {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text: string;
}

export interface EmailService {
    send(msg: EmailMessage): Promise<void>;
}
