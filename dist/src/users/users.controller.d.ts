import type { Request } from 'express';
import { UsersService } from './users.service';
export declare class UsersPublicController {
    private users;
    constructor(users: UsersService);
    register(body: {
        name: string;
        email: string;
        password: string;
        phone?: string;
        cpf?: string;
        marketingConsent?: boolean;
    }, req: Request): Promise<any>;
}
export declare class UsersController {
    private users;
    constructor(users: UsersService);
    getProfile(userId: string): Promise<any>;
    getPoints(userId: string): Promise<{
        points: any;
        totalSavings: number;
    }>;
    getEconometro(userId: string): Promise<{
        totalSavings: number;
        level: string;
        redemptions: any;
        nextLevelAt: number | null;
        progressPercent: number;
    }>;
    getHistory(userId: string): Promise<any>;
    toggleFavorite(userId: string, offerId: string): Promise<{
        added: boolean;
        favorites: any;
    }>;
    exportData(userId: string, req: Request): Promise<{
        exportedAt: string;
        data: any;
    }>;
    deleteAccount(userId: string, req: Request): Promise<void>;
}
