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
exports.ExternalPartnersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto = __importStar(require("crypto"));
let ExternalPartnersService = class ExternalPartnersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(params) {
        const where = { status: 'active' };
        if (params.category)
            where.category = params.category;
        if (params.source)
            where.source = params.source;
        if (params.integrationType)
            where.integrationType = params.integrationType;
        const partners = await this.prisma.externalPartner.findMany({
            where,
            select: {
                id: true, name: true, category: true, description: true,
                logo: true, image: true, discount: true, integrationType: true,
                affiliateUrl: true, widgetUrl: true, voucherCode: true,
                source: true, featured: true, sortOrder: true,
                clickCount: true, conversionCount: true,
            },
            orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
        });
        return { partners, total: partners.length };
    }
    async findOne(id) {
        const p = await this.prisma.externalPartner.findUnique({
            where: { id },
            select: {
                id: true, name: true, category: true, description: true,
                logo: true, image: true, discount: true, integrationType: true,
                affiliateUrl: true, widgetUrl: true, voucherCode: true,
                apiEndpoint: true, source: true, featured: true,
                clickCount: true, conversionCount: true, totalSavings: true,
            },
        });
        if (!p || p === null)
            throw new common_1.NotFoundException('Parceiro externo não encontrado');
        return p;
    }
    async trackClick(partnerId, userId, sessionId, ip, ua) {
        const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } });
        if (!partner)
            throw new common_1.NotFoundException('Parceiro não encontrado');
        const [click] = await this.prisma.$transaction([
            this.prisma.externalClick.create({
                data: { externalPartnerId: partnerId, userId, sessionId, ipAddress: ip, userAgent: ua },
            }),
            this.prisma.externalPartner.update({
                where: { id: partnerId },
                data: { clickCount: { increment: 1 } },
            }),
        ]);
        return {
            clickId: click.id,
            redirectUrl: partner.affiliateUrl || partner.widgetUrl || null,
        };
    }
    async receivePostback(partnerId, payload) {
        const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } });
        if (!partner)
            throw new common_1.NotFoundException('Parceiro não encontrado');
        if (partner.webhookSecret) {
            const expected = crypto
                .createHmac('sha256', partner.webhookSecret)
                .update(`${partnerId}:${payload.savingsAmount}`)
                .digest('hex');
            if (payload.secret !== expected) {
                return { ok: false, message: 'Secret inválido' };
            }
        }
        const where = {};
        if (payload.clickId)
            where.id = payload.clickId;
        else if (payload.sessionId)
            where.sessionId = payload.sessionId;
        else
            return { ok: false, message: 'clickId ou sessionId obrigatório' };
        await this.prisma.$transaction([
            this.prisma.externalClick.updateMany({
                where: { ...where, externalPartnerId: partnerId, converted: false },
                data: {
                    converted: true,
                    convertedAt: new Date(),
                    savingsAmount: payload.savingsAmount,
                },
            }),
            this.prisma.externalPartner.update({
                where: { id: partnerId },
                data: {
                    conversionCount: { increment: 1 },
                    totalSavings: { increment: payload.savingsAmount },
                },
            }),
        ]);
        return { ok: true };
    }
    async create(data) {
        return this.prisma.externalPartner.create({
            data: {
                ...data,
                integrationType: data.integrationType,
                source: data.source || 'manual',
            },
        });
    }
    async update(id, data) {
        return this.prisma.externalPartner.update({ where: { id }, data });
    }
    async remove(id) {
        await this.prisma.externalPartner.delete({ where: { id } });
        return { ok: true };
    }
    async importBulk(partners) {
        const results = { created: 0, skipped: 0, errors: [] };
        for (const p of partners) {
            try {
                if (p.externalId && p.source) {
                    const existing = await this.prisma.externalPartner.findFirst({
                        where: { externalId: p.externalId, source: p.source },
                    });
                    if (existing) {
                        results.skipped++;
                        continue;
                    }
                }
                await this.prisma.externalPartner.create({
                    data: { ...p, integrationType: p.integrationType, source: p.source || 'import' },
                });
                results.created++;
            }
            catch (e) {
                results.errors.push(`${p.name}: ${e instanceof Error ? e.message : 'erro'}`);
            }
        }
        return results;
    }
    async getStats() {
        const [total, byType, topClicked, totalSavings] = await Promise.all([
            this.prisma.externalPartner.count({ where: { status: 'active' } }),
            this.prisma.externalPartner.groupBy({
                by: ['integrationType'],
                _count: { id: true },
            }),
            this.prisma.externalPartner.findMany({
                where: { status: 'active' },
                orderBy: { clickCount: 'desc' },
                take: 5,
                select: { id: true, name: true, clickCount: true, conversionCount: true, totalSavings: true },
            }),
            this.prisma.externalPartner.aggregate({
                _sum: { totalSavings: true, clickCount: true, conversionCount: true },
            }),
        ]);
        return {
            total,
            byType: byType.map(b => ({ type: b.integrationType, count: b._count.id })),
            topClicked,
            totals: {
                clicks: Number(totalSavings._sum.clickCount ?? 0),
                conversions: Number(totalSavings._sum.conversionCount ?? 0),
                savings: Number(totalSavings._sum.totalSavings ?? 0),
            },
        };
    }
};
exports.ExternalPartnersService = ExternalPartnersService;
exports.ExternalPartnersService = ExternalPartnersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExternalPartnersService);
//# sourceMappingURL=external-partners.service.js.map