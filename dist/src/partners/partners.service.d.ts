import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { RegisterPartnerDto } from './dto/register-partner.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
export declare class PartnersService {
    private prisma;
    private crypto;
    private audit;
    constructor(prisma: PrismaService, crypto: CryptoService, audit: AuditService);
    register(dto: RegisterPartnerDto, ip?: string): Promise<any>;
    getProfile(partnerId: string): Promise<any>;
    getDashboard(partnerId: string): Promise<{
        partner: any;
        offers: any;
        stats: {
            totalRedemptions: any;
            totalSales: number;
            totalSavingsGenerated: number;
            pendingCommissions: number;
        };
        recentTransactions: any;
    }>;
    getOffers(partnerId: string): Promise<any>;
    createOffer(partnerId: string, dto: CreateOfferDto): Promise<any>;
    updateOffer(partnerId: string, offerId: string, dto: Partial<CreateOfferDto>): Promise<any>;
    deleteOffer(partnerId: string, offerId: string): Promise<void>;
    generateApiKey(partnerId: string): Promise<{
        apiKey: string;
        message: string;
    }>;
    revokeApiKey(partnerId: string): Promise<void>;
    getWebhooks(partnerId: string): Promise<any>;
    createWebhook(partnerId: string, dto: CreateWebhookDto): Promise<any>;
    deleteWebhook(partnerId: string, webhookId: string): Promise<void>;
    getTransactions(partnerId: string): Promise<any>;
    validateCode(partnerId: string, code: string): Promise<{
        valid: boolean;
        customer: any;
        offer: any;
        discount: any;
        finalAmount: number;
        savingsAmount: number;
        validatedAt: string;
    }>;
    private safePartner;
}
