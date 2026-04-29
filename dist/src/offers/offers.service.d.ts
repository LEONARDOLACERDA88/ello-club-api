import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class OffersService {
    private prisma;
    private audit;
    constructor(prisma: PrismaService, audit: AuditService);
    findAll(params: {
        category?: string;
        search?: string;
        sort?: string;
    }): Promise<{
        offers: any;
        total: any;
    }>;
    findOne(id: string): Promise<any>;
    redeem(userId: string, offerId: string, ip?: string): Promise<{
        code: string;
        discount: any;
        finalAmount: number;
        savingsAmount: number;
        validUntil: string;
        pointsRemaining: number;
    }>;
    private dispatchWebhook;
    private generateCode;
}
