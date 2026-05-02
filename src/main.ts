import * as Sentry from '@sentry/node'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import helmet from 'helmet'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: 0.1,
  })
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Segurança: headers HTTP seguros com CSP explícito
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }))

  // CORS — só aceita origem do frontend
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'https://ello-club.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  })

  // Validação global — rejeita DTOs inválidos
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // remove campos não declarados no DTO
    forbidNonWhitelisted: true,
    transform: true,
  }))

  // Health check para Railway
  app.getHttpAdapter().getInstance().get('/api/health', (_req: any, res: any) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  const port = process.env.PORT ?? 4001
  await app.listen(port)
  console.log(`ELLO Club API rodando na porta ${port}`)
}

bootstrap()
