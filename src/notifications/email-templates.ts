// src/notifications/email-templates.ts

import { Prisma } from '@prisma/client'; // Para Prisma.Decimal

export interface CustomerInfoForEmail {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null; // Asegúrate que el email esté aquí
}

export interface StoreInfoForEmail {
  name: string;
  address?: string | null;
  phone?: string | null;
  defaultTaxRate?: Prisma.Decimal | null; // Añadido por si se usa en cotización
}

export const getRepairReceivedEmail = (
  repairNumber: string,
  customer: CustomerInfoForEmail | null, // Usa la interfaz
  deviceBrand: string,
  deviceModel: string,
  reportedIssue: string,
  storeInfo: StoreInfoForEmail, // Usa la interfaz
): string => {
  // <-- Tipo de retorno: string
  const customerName =
    customer?.firstName || customer?.lastName
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      : 'Estimado Cliente';

  return `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 15px; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #fff;">
    <h2 style="color: #3498db; text-align: center;">Orden de Reparación Recibida - #${repairNumber}</h2>
    <p>Hola ${customerName},</p>
    <p>Confirmamos la recepción de tu dispositivo en <strong>${storeInfo.name}</strong>. A continuación, los detalles:</p>
    <ul style="list-style-type: none; padding: 0;">
      <li><strong>Dispositivo:</strong> ${deviceBrand} ${deviceModel}</li>
      <li><strong>Problema Reportado:</strong> ${reportedIssue}</li>
    </ul>
    <p>Nuestro equipo técnico comenzará el diagnóstico a la brevedad. Te contactaremos con una cotización o si necesitamos más información.</p>
    <p>Gracias por tu confianza,</p>
    <p style="font-size: 0.9em; color: #555;">
      El equipo de ${storeInfo.name}<br>
      ${storeInfo.address ? `${storeInfo.address}<br>` : ''}
      ${storeInfo.phone ? `Tel: ${storeInfo.phone}<br>` : ''}
    </p>
  </div>
</div>
    `;
};

export const getQuoteReadyEmail = (
  repairNumber: string,
  customer: CustomerInfoForEmail | null,
  deviceBrand: string,
  deviceModel: string,
  quotedAmount: Prisma.Decimal | number | string, // Permitir diferentes tipos, convertir a string si es necesario
  storeInfo: StoreInfoForEmail,
): string => {
  const customerName =
    customer?.firstName || customer?.lastName
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      : 'Estimado Cliente';
  const amountString =
    typeof quotedAmount === 'number'
      ? quotedAmount.toFixed(2)
      : quotedAmount.toString();

  return `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 15px; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #fff;">
    <h2 style="color: #3498db; text-align: center;">Cotización Lista - Reparación #${repairNumber}</h2>
    <p>Hola ${customerName},</p>
    <p>La cotización para la reparación de tu dispositivo <strong>${deviceBrand} ${deviceModel}</strong> (Orden: <strong>#${repairNumber}</strong>) está lista:</p>
    <p style="font-size: 1.3em; font-weight: bold; color: #2c3e50; text-align: center; margin: 20px 0; padding:10px; background-color:#eaf5fb; border-radius:4px;">
      Monto Cotizado: $${amountString}
    </p>
    <p>Por favor, ponte en contacto con nosotros para aprobar esta cotización y proceder con la reparación. Puedes responder a este correo o llamarnos.</p>
    <p>Si no recibimos tu aprobación en un plazo de 5 días hábiles, podríamos proceder a reensamblar tu equipo sin reparar.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 0.9em; color: #555;">
      Atentamente,<br>
      El equipo de ${storeInfo.name}<br>
      ${storeInfo.address ? `${storeInfo.address}<br>` : ''}
      ${storeInfo.phone ? `Tel: ${storeInfo.phone}<br>` : ''}
    </p>
  </div>
</div>
    `;
};

export const getRepairReadyForPickupEmail = (
  repairNumber: string,
  customer: CustomerInfoForEmail | null,
  deviceBrand: string,
  deviceModel: string,
  storeInfo: StoreInfoForEmail,
): string => {
  const customerName =
    customer?.firstName || customer?.lastName
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      : 'Estimado Cliente';

  return `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 15px; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #fff;">
    <h2 style="color: #27ae60; text-align: center;">¡Tu Dispositivo Está Listo para Retirar! - #${repairNumber}</h2>
    <p>Hola ${customerName},</p>
    <p>¡Buenas noticias! La reparación de tu dispositivo <strong>${deviceBrand} ${deviceModel}</strong> (Orden: <strong>#${repairNumber}</strong>) ha sido completada y está listo para que pases a retirarlo.</p>
    <p>Te esperamos en ${storeInfo.name}. Nuestro horario es [TU HORARIO AQUÍ].</p>
    <p>Recuerda traer tu comprobante de orden o identificación.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 0.9em; color: #555;">
      Atentamente,<br>
      El equipo de ${storeInfo.name}<br>
      ${storeInfo.address ? `${storeInfo.address}<br>` : ''}
      ${storeInfo.phone ? `Tel: ${storeInfo.phone}<br>` : ''}
    </p>
  </div>
</div>
    `;
};

export const getRepairPickedUpEmail = (
  repairNumber: string,
  customer: CustomerInfoForEmail | null,
  deviceBrand: string,
  deviceModel: string,
  saleNumber: string | null | undefined,
  storeInfo: StoreInfoForEmail,
): string => {
  const customerName =
    customer?.firstName || customer?.lastName
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      : 'Estimado Cliente';

  return `
<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 15px; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #fff;">
    <h2 style="color: #2c3e50; text-align: center;">Dispositivo Entregado - Reparación #${repairNumber}</h2>
    <p>Hola ${customerName},</p>
    <p>Confirmamos la entrega de tu dispositivo reparado: <strong>${deviceBrand} ${deviceModel}</strong>.</p>
    ${saleNumber ? `<p>Esta reparación fue asociada a la Venta/Factura Nro: <strong>${saleNumber}</strong>.</p>` : ''}
    <p>Agradecemos tu confianza. Esperamos que todo funcione perfectamente.</p>
    <p>No olvides que tu reparación tiene una garantía de ${storeInfo.name} por [DÍAS DE GARANTÍA, ej: 90 días] sobre el trabajo realizado.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 0.9em; color: #555;">
      Atentamente,<br>
      El equipo de ${storeInfo.name}<br>
      ${storeInfo.address ? `${storeInfo.address}<br>` : ''}
      ${storeInfo.phone ? `Tel: ${storeInfo.phone}<br>` : ''}
    </p>
  </div>
</div>
    `;
};
