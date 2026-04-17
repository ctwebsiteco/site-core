import * as resend from 'resend';

type SendArgs = {
    to: string | string[];
    subject: string;
    html: string;
    replyTo?: string;
    from?: string;
};
declare function sendEmail({ to, subject, html, replyTo, from }: SendArgs): Promise<resend.CreateEmailResponse>;

export { sendEmail };
