import { PrismaService } from '../prisma/prisma.service';
export interface AuditEntry {
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, string | number | boolean | null>;
}
export declare class AuditService {
    private prisma;
    constructor(prisma: PrismaService);
    log(entry: AuditEntry): Promise<void>;
}
