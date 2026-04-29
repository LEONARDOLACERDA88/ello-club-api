import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
export declare class AdminService {
    private prisma;
    private audit;
    constructor(prisma: PrismaService, audit: AuditService);
    createFirstAdmin(email: string, password: string, name: string): Promise<any>;
    getDashboard(): Promise<{
        users: {
            total: any;
        };
        partners: {
            total: any;
            pending: any;
            active: any;
        };
        offers: {
            active: any;
        };
        transactions: {
            total: any;
            totalRevenue: number;
            totalSavings: number;
        };
        topPartners: any;
        recentTransactions: any;
    }>;
    getPartners(status?: string): Promise<any>;
    approvePartner(adminId: string, partnerId: string): Promise<{
        message: string;
    }>;
    suspendPartner(adminId: string, partnerId: string, reason?: string): Promise<{
        message: string;
    }>;
    getUsers(page?: number, limit?: number): Promise<{
        users: any;
        total: any;
        page: number;
        pages: number;
    }>;
    updateUserStatus(adminId: string, userId: string, status: string): Promise<{
        message: string;
    }>;
    getCommissions(status?: string): Promise<any>;
    payCommissions(adminId: string, partnerId: string): Promise<{
        message: string;
        totalPaid: any;
    }>;
    getReports(): Promise<{
        period: string;
        transactions: {
            count: any;
            totalRevenue: number;
            totalSavings: number;
        };
        newUsers: any;
        topOffers: any;
        categoryBreakdown: any;
        lgpdRequests: any;
    }>;
    getAuditLogs(page?: number): Promise<{
        logs: any;
        total: any;
        page: number;
        pages: number;
    }>;
}
