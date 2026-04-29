import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface AuditEntry {
  userId?: string
  action: string
  entity?: string
  entityId?: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, string | number | boolean | null>
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    const { userId, ...rest } = entry
    await this.prisma.auditLog.create({
      data: {
        ...rest,
        ...(userId ? { user: { connect: { id: userId } } } : {}),
      },
    })
  }
}
