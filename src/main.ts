import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        // enableImplicitConversion: true,
      },
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
  });

  // --- AÑADIR CONFIGURACIÓN SWAGGER --- V V V
  const config = new DocumentBuilder()
    .setTitle('SaaShopix API')
    .setDescription('API para la gestión de tiendas de celulares SaaShopix')
    .setVersion('1.0')
    // .addTag('auth', 'Endpoints de Autenticación') // Puedes añadir tags aquí o en controladores
    // .addTag('users', 'Endpoints de Usuarios')
    .addBearerAuth() // <-- IMPORTANTE: Habilita la autorización por Bearer Token (JWT) en la UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Elige la ruta donde estará disponible la documentación interactiva
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Opcional: mantiene el token JWT entre recargas de la página
    },
  });
  // --- FIN CONFIGURACIÓN SWAGGER --- V V V
  // app.enableCors(); // Considera configuraciones más específicas para producción

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger Docs available at: ${await app.getUrl()}/api-docs`);
}
bootstrap().catch((err) => {
  console.error('Error starting server:', err); // Manejar posible error al arrancar
  process.exit(1); // Salir si hay un error crítico al inicio
});
