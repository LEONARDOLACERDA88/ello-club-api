import { PrismaService } from '../prisma/prisma.service';
export declare class ExternalPartnersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(params: {
        category?: string;
        source?: string;
        integrationType?: string;
    }): Promise<{
        partners: any;
        total: any;
    }>;
    findOne(id: string): Promise<any>;
    trackClick(partnerId: string, userId?: string, sessionId?: string, ip?: string, ua?: string): Promise<{
        clickId: any;
        redirectUrl: any;
    }>;
    receivePostback(partnerId: string, payload: {
        clickId?: string;
        sessionId?: string;
        savingsAmount: number;
        secret: string;
    }): Promise<{
        ok: boolean;
        message: string;
    } | {
        ok: boolean;
        message?: undefined;
    }>;
    create(data: {
        name: string;
        category: string;
        description?: string;
        logo?: string;
        image?: string;
        discount?: number;
        integrationType: string;
        affiliateUrl?: string;
        apiEndpoint?: string;
        apiKey?: string;
        widgetUrl?: string;
        voucherCode?: string;
        webhookSecret?: string;
        source?: string;
        externalId?: string;
        featured?: boolean;
        sortOrder?: number;
    }): Promise<any>;
    update(id: string, data: Partial<{
        name: string;
        category: string;
        description: string;
        logo: string;
        image: string;
        discount: number;
        affiliateUrl: string;
        apiEndpoint: string;
        apiKey: string;
        widgetUrl: string;
        voucherCode: string;
        webhookSecret: string;
        status: string;
        featured: boolean;
        sortOrder: number;
        source: string;
    }>): Promise<any>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    importBulk(partners: Array<{
        name: string;
        category: string;
        integrationType: string;
        affiliateUrl?: string;
        apiEndpoint?: string;
        widgetUrl?: string;
        voucherCode?: string;
        discount?: number;
        logo?: string;
        image?: string;
        description?: string;
        source?: string;
        externalId?: string;
    }>): Promise<{
        created: number;
        skipped: number;
        errors: string[];
    }>;
    getStats(): Promise<{
        total: any;
        byType: any;
        topClicked: any;
        totals: {
            clicks: number;
            conversions: number;
            savings: number;
        };
    }>;
}
