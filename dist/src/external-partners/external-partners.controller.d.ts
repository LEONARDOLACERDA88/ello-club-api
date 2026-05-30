import type { Request } from 'express';
import { ExternalPartnersService } from './external-partners.service';
export declare class ExternalPartnersController {
    private service;
    constructor(service: ExternalPartnersService);
    findAll(q: {
        category?: string;
        source?: string;
        integrationType?: string;
    }): Promise<{
        partners: any;
        total: any;
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
    findOne(id: string): Promise<any>;
    trackClick(partnerId: string, body: {
        sessionId?: string;
    }, req: Request, userId?: string): Promise<{
        clickId: any;
        redirectUrl: any;
    }>;
    receivePostback(partnerId: string, body: {
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
    create(body: any): Promise<any>;
    update(id: string, body: any): Promise<any>;
    remove(id: string): Promise<{
        ok: boolean;
    }>;
    importBulk(body: {
        partners: any[];
    }): Promise<{
        created: number;
        skipped: number;
        errors: string[];
    }>;
}
