import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class OffersService {
    private prisma;
    private audit;
    private notifications;
    constructor(prisma: PrismaService, audit: AuditService, notifications: NotificationsService);
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
