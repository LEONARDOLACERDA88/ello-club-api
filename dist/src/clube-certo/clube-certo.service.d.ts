import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare class ClubeCertoService implements OnModuleInit {
    private prisma;
    private readonly logger;
    private companyToken;
    private tokenExpiresAt;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    getCompanyToken(): Promise<string>;
    getUserToken(cpf: string): Promise<string>;
    syncAll(): Promise<{
        discounts: number;
        cashback: number;
        syncedAt: Date;
    }>;
    private getUserTokenForSync;
    private syncDiscounts;
    private syncCashback;
    getPersonalizedLink(partnerId: string, userCpf: string): Promise<string>;
    getStats(): Promise<{
        discounts: any;
        cashback: any;
        total: any;
        active: any;
        inactive: any;
    }>;
    registerUser(data: {
        name: string;
        cpf: string;
        email?: string;
        birthDate?: string;
        phone?: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    getCategories(): Promise<any[]>;
    searchEstablishments(params: {
        cityId?: number;
        categoryId?: number;
        search?: string;
        page?: number;
    }): Promise<any>;
    getStates(): Promise<any[]>;
    getCities(stateId: number): Promise<any[]>;
    getCashbackWalletUrl(cpf: string): string;
    getEstablishmentDetail(id: number): Promise<any>;
    toggleStatus(partnerId: string): Promise<{
        status: string;
    }>;
    listForAdmin(params: {
        source?: string;
        category?: string;
        status?: string;
        search?: string;
    }): Promise<{
        partners: any;
        total: any;
    }>;
}
