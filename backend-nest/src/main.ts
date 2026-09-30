import { NestFactory } from '@nestjs/core';
import { UnprocessableEntityException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsList = (config.get<string>('CORS_ORIGINS', 'http://localhost:5173') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsList,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => {
        const mensajes: string[] = [];
        const extraer = (lista: typeof errors) => {
          for (const err of lista) {
            for (const m of Object.values(err.constraints ?? {})) {
              mensajes.push(m);
            }
            if (err.children && err.children.length > 0) {
              extraer(err.children as typeof errors);
            }
          }
        };
        extraer(errors);
        return new UnprocessableEntityException(mensajes.length > 0 ? mensajes : Object.keys(errors[0] ?? {}));
      },
    }),
  );

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 Tiendas Montaño API lista en http://localhost:${port}/api/v1`);
}
void bootstrap();