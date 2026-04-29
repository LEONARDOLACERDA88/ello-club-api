"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let AdminService = class AdminService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async createFirstAdmin(email, password, name) {
        const exists = await this.prisma.admin.findFirst();
        if (exists)
            throw new common_1.BadRequestException('Admin já existe');
        const passwordHash = await bcrypt.hash(password, 12);
        return this.prisma.admin.create({ data: { name, email, passwordHash, role: 'SUPER_ADMIN' } });
    }
    async getDashboard() {
        const [totalUsers, totalPartners, pendingPartners, activePartners, totalOffers, totalTransactions, revenueStats, topPartners, recentTransactions,] = await Promise.all([
            this.prisma.user.count({ where: { deletedAt: null } }),
            this.prisma.partner.count(),
            this.prisma.partner.count({ where: { status: 'PENDING' } }),
            this.prisma.partner.count({ where: { status: 'ACTIVE' } }),
            this.prisma.offer.count({ where: { status: 'ACTIVE' } }),
            this.prisma.transaction.count(),
            this.prisma.transaction.aggregate({
                where: { status: 'VALIDATED' },
                _sum: { finalAmount: true, savingsAmount: true },
            }),
            this.prisma.partner.findMany({
                where: { status: 'ACTIVE' },
                include: { _count: { select: { transactions: true } } },
                orderBy: { transactions: { _count: 'desc' } },
                take: 5,
            }),
            this.prisma.transaction.findMany({
                include: {
                    user: { select: { name: true } },
                    offer: { select: { title: true } },
                    partner: { select: { name: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);
        return {
            users: { total: totalUsers },
            partners: { total: totalPartners, pending: pendingPartners, active: activePartners },
            offers: { active: totalOffers },
            transactions: {
                total: totalTransactions,
                totalRevenue: Number(revenueStats._sum.finalAmount ?? 0),
                totalSavings: Number(revenueStats._sum.savingsAmount ?? 0),
            },
            topPartners,
            recentTransactions,
        };
    }
    async getPartners(status) {
        const where = status ? { status: status } : {};
        return this.prisma.partner.findMany({
            where,
            include: { _count: { select: { offers: true, transactions: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async approvePartner(adminId, partnerId) {
        const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
        if (!partner)
            throw new common_1.NotFoundException('Parceiro não encontrado');
        if (partner.status !== 'PENDING')
            throw new common_1.BadRequestException('Parceiro não está pendente');
        await this.prisma.partner.update({
            where: { id: partnerId },
            data: { status: 'ACTIVE' },
        });
        await this.audit.log({
            userId: adminId,
            action: 'admin.partner_approved',
            entity: 'Partner',
            entityId: partnerId,
        });
        return { message: `Parceiro ${partner.name} aprovado com sucesso` };
    }
    async suspendPartner(adminId, partnerId, reason) {
        await this.prisma.partner.update({
            where: { id: partnerId },
            data: { status: 'SUSPENDED' },
        });
        await this.audit.log({
            userId: adminId,
            action: 'admin.partner_suspended',
            entity: 'Partner',
            entityId: partnerId,
            metadata: { reason: reason ?? 'Não informado' },
        });
        return { message: 'Parceiro suspenso' };
    }
    async getUsers(page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where: { deletedAt: null },
                select: {
                    id: true, name: true, email: true, phone: true,
                    points: true, totalSavings: true, level: true,
                    status: true, createdAt: true,
                    _count: { select: { transactions: true, favorites: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.user.count({ where: { deletedAt: null } }),
        ]);
        return { users, total, page, pages: Math.ceil(total / limit) };
    }
    async updateUserStatus(adminId, userId, status) {
        const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
        if (!validStatuses.includes(status)) {
            throw new common_1.BadRequestException(`Status inválido. Use: ${validStatuses.join(', ')}`);
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { status: status },
        });
        await this.audit.log({
            userId: adminId,
            action: 'admin.user_status_updated',
            entity: 'User',
            entityId: userId,
            metadata: { newStatus: status },
        });
        return { message: `Usuário atualizado para ${status}` };
    }
    async getCommissions(status) {
        const where = status ? { status: status } : {};
        return this.prisma.commission.findMany({
            where,
            include: {
                partner: { select: { name: true, email: true } },
                transaction: { select: { code: true, finalAmount: true, createdAt: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }
    async payCommissions(adminId, partnerId) {
        const pending = await this.prisma.commission.findMany({
            where: { partnerId, status: 'PENDING' },
        });
        if (!pending.length)
            throw new common_1.BadRequestException('Nenhuma comissão pendente para este parceiro');
        const total = pending.reduce((sum, c) => sum + Number(c.amount), 0);
        await this.prisma.commission.updateMany({
            where: { partnerId, status: 'PENDING' },
            data: { status: 'PAID', paidAt: new Date() },
        });
        await this.audit.log({
            userId: adminId,
            action: 'admin.commissions_paid',
            entity: 'Partner',
            entityId: partnerId,
            metadata: { totalPaid: total, count: pending.length },
        });
        return { message: `${pending.length} comissões pagas`, totalPaid: total };
    }
    async getReports() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [monthlySavings, topOffers, categoryBreakdown, newUsersThisMonth, lgpdRequests] = await Promise.all([
            this.prisma.transaction.aggregate({
                where: { createdAt: { gte: thirtyDaysAgo }, status: 'VALIDATED' },
                _sum: { savingsAmount: true, finalAmount: true },
                _count: true,
            }),
            this.prisma.offer.findMany({
                orderBy: { currentRedemptions: 'desc' },
                take: 10,
                select: { title: true, currentRedemptions: true, discount: true,
                    partner: { select: { name: true } } },
            }),
            this.prisma.offer.groupBy({
                by: ['category'],
                _count: { id: true },
                _sum: { currentRedemptions: true },
            }),
            this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
            this.prisma.lgpdRequest.groupBy({
                by: ['type'],
                _count: { id: true },
            }),
        ]);
        return {
            period: '30 dias',
            transactions: {
                count: monthlySavings._count,
                totalRevenue: Number(monthlySavings._sum.finalAmount ?? 0),
                totalSavings: Number(monthlySavings._sum.savingsAmount ?? 0),
            },
            newUsers: newUsersThisMonth,
            topOffers,
            categoryBreakdown,
            lgpdRequests,
        };
    }
    async getAuditLogs(page = 1) {
        const skip = (page - 1) * 50;
        const [logs, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                include: { user: { select: { name: true, email: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: 50,
            }),
            this.prisma.auditLog.count(),
        ]);
        return { logs, total, page, pages: Math.ceil(total / 50) };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], AdminService);
//# sourceMappingURL=admin.service.js.map