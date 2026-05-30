import type { Request } from 'express';
import { AsaasService, PlanKey } from './asaas.service';
export declare class AsaasController {
    private readonly svc;
    private readonly logger;
    constructor(svc: AsaasService);
    subscribe(user: any, body: {
        planKey: PlanKey;
        billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
        cpf: string;
        phone?: string;
    }): Promise<{
        subscriptionId: string;
        paymentUrl: string;
        invoiceUrl?: string;
    }>;
    trackLead(user: any, body: {
        event: 'viewed_plans' | 'abandoned_checkout';
        planKey?: string;
    }): Promise<{
        ok: boolean;
    }>;
    webhook(token: string, body: any, req: Request): Promise<{
        ok: boolean;
    }>;
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
