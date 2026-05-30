import { PrismaService } from '../prisma/prisma.service';
import { ClubeCertoService } from '../clube-certo/clube-certo.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare const PLANS: {
    readonly individual: {
        readonly name: "Fundador Individual";
        readonly price: 29.9;
        readonly level: "SILVER";
    };
    readonly familia: {
        readonly name: "Fundador Família";
        readonly price: 49.9;
        readonly level: "GOLD";
    };
    readonly empresarial: {
        readonly name: "Empresarial";
        readonly price: 199;
        readonly level: "GOLD";
    };
};
export type PlanKey = keyof typeof PLANS;
export declare class AsaasService {
    private prisma;
    private clubeCerto;
    private notifications;
    private readonly logger;
    constructor(prisma: PrismaService, clubeCerto: ClubeCertoService, notifications: NotificationsService);
    private get headers();
    upsertCustomer(data: {
        userId: string;
        name: string;
        email: string;
        cpf: string;
        phone?: string;
    }): Promise<string>;
    createSubscription(data: {
        userId: string;
        customerId: string;
        planKey: PlanKey;
        billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
    }): Promise<{
        subscriptionId: string;
        paymentUrl: string;
        invoiceUrl?: string;
    }>;
    processWebhook(event: string, payment: any): Promise<void>;
    private activatePlan;
    private handleOverdue;
    private deactivatePlan;
    trackLeadEvent(data: {
        userId?: string;
        email?: string;
        name?: string;
        event: 'viewed_plans' | 'selected_plan' | 'abandoned_checkout';
        planKey?: string;
        metadata?: any;
    }): Promise<void>;
    private triggerN8n;
    getStats(): Promise<{
        subscriptions: {
            active: any;
            pending: any;
            cancelled: any;
        };
        mrr: number;
        leads: {
            [k: string]: any;
        };
    }>;
}
