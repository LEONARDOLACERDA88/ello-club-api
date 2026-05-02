import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'
import helmet from 'helmet'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Segurança: headers HTTP seguros
  app.use(helmet())

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
