// src/notifications/notification.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
// import { ConfigService } from '@nestjs/config'; // No es estrictamente necesario para Ethereal

@Injectable()
export class NotificationService implements OnModuleInit {
  private transporter: nodemailer.Transporter | undefined;
  private readonly logger = new Logger(NotificationService.name);

  // constructor(private readonly configService: ConfigService) {} // Quitar si no usas ConfigService aquí

  async onModuleInit() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.logger.log(`Ethereal User: ${testAccount.user}`);
      this.logger.log(`Ethereal Pass: ${testAccount.pass}`);

      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email', // Ethereal SMTP
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log('Nodemailer transporter para Ethereal inicializado.');
    } catch (error) {
      this.logger.error(
        'Fallo al crear cuenta de Ethereal o transporter:',
        error,
      );
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    textBody?: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error(
        'Transporter no inicializado. No se puede enviar email.',
      );
      return false;
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: '"SaaShopix Notificaciones" <noreply@saashopix.com>',
      to,
      subject,
      text: textBody ?? htmlBody.replace(/<[^>]*>?/gm, ''),
      html: htmlBody,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email enviado: ${info.messageId}`);
      this.logger.log(
        `Preview URL (Ethereal): ${nodemailer.getTestMessageUrl(info)}`,
      ); // <-- URL para ver el email
      return true;
    } catch (error) {
      this.logger.error(
        `Error enviando email a ${to} con asunto "${subject}":`,
        error,
      );
      return false;
    }
  }
}
