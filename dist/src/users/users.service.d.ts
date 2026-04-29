import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
export declare class UsersService {
    private prisma;
    private crypto;
    private audit;
    constructor(prisma: PrismaService, crypto: CryptoService, audit: AuditService);
    register(dto: {
        name: string;
        email: string;
        password: string;
        phone?: string;
        cpf?: string;
        lgpdConsentIp: string;
        lgpdConsentVersion: string;
        marketingConsent?: boolean;
    }): Promise<any>;
    getProfile(userId: string): Promise<any>;
    getEconometro(userId: string): Promise<{
        totalSavings: number;
        level: string;
        redemptions: any;
        nextLevelAt: number | null;
        progressPercent: number;
    }>;
    toggleFavorite(userId: string, offerId: string): Promise<{
        added: boolean;
        favorites: any;
    }>;
    getPoints(userId: string): Promise<{
        points: any;
        totalSavings: number;
    }>;
    exportData(userId: string, ip: string): Promise<{
        exportedAt: string;
        data: any;
    }>;
    deleteAccount(userId: string, ip: string): Promise<void>;
    getHistory(userId: string): Promise<any>;
    private safeUser;
}
