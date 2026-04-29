import type { Request } from 'express';
import { OffersService } from './offers.service';
export declare class OffersController {
    private offers;
    constructor(offers: OffersService);
    findAll(query: {
        category?: string;
        search?: string;
        sort?: string;
    }): Promise<{
        offers: any;
        total: any;
    }>;
    findOne(id: string): Promise<any>;
    redeem(offerId: string, userId: string, req: Request): Promise<{
        code: string;
        discount: any;
        finalAmount: number;
        savingsAmount: number;
        validUntil: string;
        pointsRemaining: number;
    }>;
}
