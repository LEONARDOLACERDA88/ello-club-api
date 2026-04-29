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
exports.OffersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const crypto = __importStar(require("crypto"));
let OffersService = class OffersService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async findAll(params) {
        const where = { status: 'ACTIVE' };
        if (params.category)
            where.category = params.category;
        if (params.search) {
            where.OR = [
                { title: { contains: params.search, mode: 'insensitive' } },
                { description: { contains: params.search, mode: 'insensitive' } },
            ];
        }
        const offers = await this.prisma.offer.findMany({
            where,
            include: { partner: { select: { id: true, name: true, logo: true, category: true } } },
            orderBy: params.sort === 'rating' ? { rating: 'desc' } : { createdAt: 'desc' },
        });
        return { offers, total: offers.length };
    }
    async findOne(id) {
        const offer = await this.prisma.offer.findUnique({
            where: { id },
            include: { partner: { select: { id: true, name: true, logo: true, phone: true, website: true } } },
        });
        if (!offer || offer.status !== 'ACTIVE')
            throw new common_1.NotFoundException('Oferta não encontrada');
        return offer;
    }
    async redeem(userId, offerId, ip) {
        const offer = await this.prisma.offer.findUnique({
            where: { id: offerId },
            include: { partner: true },
        });
        if (!offer || offer.status !== 'ACTIVE')
            throw new common_1.NotFoundException('Oferta não disponível');
        if (offer.maxRedemptions && offer.currentRedemptions >= offer.maxRedemptions) {
            throw new common_1.BadRequestException('Limite de resgates atingido');
        }
        if (offer.validUntil && offer.validUntil < new Date()) {
            throw new common_1.BadRequestException('Oferta expirada');
        }
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('Usuário não encontrado');
        if (user.points < offer.pointsRequired) {
            throw new common_1.BadRequestException(`Pontos insuficientes. Necessário: ${offer.pointsRequired}`);
        }
        const savingsAmount = Number(offer.originalPrice) - Number(offer.finalPrice);
        const code = this.generateCode();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const [transaction] = await this.prisma.$transaction([
            this.prisma.transaction.create({
                data: {
                    userId,
                    offerId,
                    partnerId: offer.partnerId,
                    code,
                    discount: offer.discount,
                    originalPrice: offer.originalPrice,
                    finalAmount: offer.finalPrice,
                    savingsAmount,
                    pointsUsed: offer.pointsRequired,
                    expiresAt,
                },
            }),
            this.prisma.offer.update({
                where: { id: offerId },
                data: { currentRedemptions: { increment: 1 } },
            }),
            this.prisma.user.update({
                where: { id: userId },
                data: { points: { decrement: offer.pointsRequired } },
            }),
        ]);
        if (typeof offer.partner === 'object') {
            const commissionAmount = (Number(offer.finalPrice) * Number(offer.partner.commissionRate)) / 100;
            await this.prisma.commission.create({
                data: {
                    transactionId: transaction.id,
                    partnerId: offer.partnerId,
                    amount: commissionAmount,
                    percentage: offer.partner.commissionRate,
                },
            });
        }
        await this.audit.log({
            userId,
            action: 'offer.redeemed',
            entity: 'Transaction',
            entityId: transaction.id,
            ipAddress: ip,
        });
        this.dispatchWebhook(offer.partnerId, 'redemption.created', {
            transactionId: transaction.id,
            code,
            userId,
            offerId,
            discount: offer.discount,
            finalAmount: Number(offer.finalPrice),
        }).catch(() => { });
        return {
            code,
            discount: offer.discount,
            finalAmount: Number(offer.finalPrice),
            savingsAmount,
            validUntil: expiresAt.toISOString(),
            pointsRemaining: user.points - offer.pointsRequired,
        };
    }
    async dispatchWebhook(partnerId, event, payload) {
        const webhooks = await this.prisma.partnerWebhook.findMany({
            where: { partnerId, active: true, events: { has: event } },
        });
        for (const wh of webhooks) {
            const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
            const signature = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
            fetch(wh.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Ello-Signature': `sha256=${signature}`,
                },
                body,
            }).catch(() => { });
        }
    }
    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }
};
exports.OffersService = OffersService;
exports.OffersService = OffersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], OffersService);
//# sourceMappingURL=offers.service.js.map