import { AdminService } from './admin.service';
export declare class AdminController {
    private admin;
    constructor(admin: AdminService);
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
    suspendPartner(adminId: string, partnerId: string, body: {
        reason?: string;
    }): Promise<{
        message: string;
    }>;
    getUsers(page?: string): Promise<{
        users: any;
        total: any;
        page: number;
        pages: number;
    }>;
    updateUserStatus(adminId: string, userId: string, body: {
        status: string;
    }): Promise<{
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
    getAuditLogs(page?: string): Promise<{
        logs: any;
        total: any;
        page: number;
        pages: number;
    }>;
}
export declare class AdminSetupController {
    private admin;
    constructor(admin: AdminService);
    setup(body: {
        email: string;
        password: string;
        name: string;
        setupSecret: string;
    }): Promise<any>;
}
