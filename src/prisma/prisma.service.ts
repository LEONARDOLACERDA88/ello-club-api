import 'dotenv/config'
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter } as any)
}

@Injectable()
export class PrismaService extends (createPrismaClient() as any).constructor {
  private static _client: PrismaClient

  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' })
    super({ adapter })
  }

  async onModuleInit() {
    await (this as any).$connect()
  }

  async onModuleDestroy() {
    await (this as any).$disconnect()
  }
}
