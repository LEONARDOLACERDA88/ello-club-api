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
exports.PartnersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_service_1 = require("../common/crypto/crypto.service");
const audit_service_1 = require("../audit/audit.service");
let PartnersService = class PartnersService {
    prisma;
    crypto;
    audit;
    constructor(prisma, crypto, audit) {
        this.prisma = prisma;
        this.crypto = crypto;
        this.audit = audit;
    }
    async register(dto, ip) {
        const [emailExists, cnpjExists] = await Promise.all([
            this.prisma.partner.findUnique({ where: { email: dto.email } }),
            this.prisma.partner.findUnique({ where: { cnpj: dto.cnpj } }),
        ]);
        if (emailExists)
            throw new common_1.ConflictException('E-mail já cadastrado');
        if (cnpjExists)
            throw new common_1.ConflictException('CNPJ já cadastrado');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const partner = await this.prisma.partner.create({
            data: {
                name: dto.name,
                email: dto.email,
                passwordHash,
                cnpj: dto.cnpj,
                category: dto.category,
                phone: dto.phone,
                website: dto.website,
                description: dto.description,
                status: 'PENDING',
            },
        });
        await this.audit.log({
            action: 'partner.registered',
            entity: 'Partner',
            entityId: partner.id,
            ipAddress: ip,
        });
        return this.safePartner(partner);
    }
    async getProfile(partnerId) {
        const partner = await this.prisma.partner.findUnique({
            where: { id: partnerId },
            include: {
                addresses: true,
                _count: { select: { offers: true, transactions: true } },
            },
        });
        if (!partner)
            throw new common_1.NotFoundException('Parceiro não encontrado');
        return this.safePartner(partner);
    }
    async getDashboard(partnerId) {
        const [partner, offers, stats, recentTransactions] = await Promise.all([
            this.prisma.partner.findUnique({ where: { id: partnerId } }),
            this.prisma.offer.findMany({
                where: { partnerId },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            this.prisma.transaction.aggregate({
                where: { partnerId },
                _sum: { savingsAmount: true, finalAmount: true },
                _count: true,
            }),
            this.prisma.transaction.findMany({
                where: { partnerId },
                include: { user: { select: { name: true } }, offer: { select: { title: true } } },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        ]);
        const pendingCommissions = await this.prisma.commission.aggregate({
            where: { partnerId, status: 'PENDING' },
            _sum: { amount: true },
        });
        return {
            partner: this.safePartner(partner),
            offers,
            stats: {
                totalRedemptions: stats._count,
                totalSales: Number(stats._sum.finalAmount ?? 0),
                totalSavingsGenerated: Number(stats._sum.savingsAmount ?? 0),
                pendingCommissions: Number(pendingCommissions._sum.amount ?? 0),
            },
            recentTransactions,
        };
    }
    async getOffers(partnerId) {
        return this.prisma.offer.findMany({
            where: { partnerId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createOffer(partnerId, dto) {
        const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
        if (!partner)
            throw new common_1.NotFoundException();
        if (partner.status !== 'ACTIVE') {
            throw new common_1.ForbiddenException('Conta pendente de aprovação. Não é possível criar ofertas ainda.');
        }
        const finalPrice = dto.originalPrice * (1 - dto.discount / 100);
        const offer = await this.prisma.offer.create({
            data: {
                partnerId,
                title: dto.title,
                description: dto.description,
                category: dto.category,
                discount: dto.discount,
                originalPrice: dto.originalPrice,
                finalPrice: parseFloat(finalPrice.toFixed(2)),
                pointsRequired: dto.pointsRequired,
                image: dto.image,
                maxRedemptions: dto.maxRedemptions,
                validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
                restrictions: dto.restrictions,
                status: 'ACTIVE',
            },
        });
        await this.audit.log({
            action: 'offer.created',
            entity: 'Offer',
            entityId: offer.id,
        });
        return offer;
    }
    async updateOffer(partnerId, offerId, dto) {
        const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
        if (!offer)
            throw new common_1.NotFoundException('Oferta não encontrada');
        if (offer.partnerId !== partnerId)
            throw new common_1.ForbiddenException('Sem permissão para editar esta oferta');
        const data = { ...dto };
        if (dto.discount !== undefined || dto.originalPrice !== undefined) {
            const originalPrice = dto.originalPrice ?? Number(offer.originalPrice);
            const discount = dto.discount ?? offer.discount;
            data.finalPrice = parseFloat((originalPrice * (1 - discount / 100)).toFixed(2));
        }
        if (dto.validUntil)
            data.validUntil = new Date(dto.validUntil);
        return this.prisma.offer.update({ where: { id: offerId }, data });
    }
    async deleteOffer(partnerId, offerId) {
        const offer = await this.prisma.offer.findUnique({ where: { id: offerId } });
        if (!offer)
            throw new common_1.NotFoundException('Oferta não encontrada');
        if (offer.partnerId !== partnerId)
            throw new common_1.ForbiddenException();
        await this.prisma.offer.update({
            where: { id: offerId },
            data: { status: 'INACTIVE' },
        });
    }
    async generateApiKey(partnerId) {
        const rawKey = this.crypto.generateApiKey();
        const keyHash = this.crypto.hashSha256(rawKey);
        await this.prisma.partner.update({
            where: { id: partnerId },
            data: { apiKeyHash: keyHash },
        });
        await this.audit.log({
            action: 'partner.api_key_generated',
            entity: 'Partner',
            entityId: partnerId,
        });
        return {
            apiKey: rawKey,
            message: 'Guarde esta chave em segurança. Ela não será exibida novamente.',
        };
    }
    async revokeApiKey(partnerId) {
        await this.prisma.partner.update({
            where: { id: partnerId },
            data: { apiKeyHash: null },
        });
        await this.audit.log({ action: 'partner.api_key_revoked', entityId: partnerId });
    }
    async getWebhooks(partnerId) {
        return this.prisma.partnerWebhook.findMany({ where: { partnerId } });
    }
    async createWebhook(partnerId, dto) {
        const VALID_EVENTS = [
            'redemption.created',
            'redemption.validated',
            'offer.expired',
            'commission.paid',
        ];
        const invalid = dto.events.filter(e => !VALID_EVENTS.includes(e));
        if (invalid.length) {
            throw new common_1.BadRequestException(`Eventos inválidos: ${invalid.join(', ')}. Válidos: ${VALID_EVENTS.join(', ')}`);
        }
        const secret = crypto.randomBytes(32).toString('hex');
        return this.prisma.partnerWebhook.create({
            data: {
                partnerId,
                url: dto.url,
                secret,
                events: dto.events,
            },
        });
    }
    async deleteWebhook(partnerId, webhookId) {
        const wh = await this.prisma.partnerWebhook.findUnique({ where: { id: webhookId } });
        if (!wh || wh.partnerId !== partnerId)
            throw new common_1.NotFoundException();
        await this.prisma.partnerWebhook.delete({ where: { id: webhookId } });
    }
    async getTransactions(partnerId) {
        return this.prisma.transaction.findMany({
            where: { partnerId },
            include: {
                user: { select: { name: true } },
                offer: { select: { title: true, discount: true } },
                commission: { select: { amount: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async validateCode(partnerId, code) {
        const tx = await this.prisma.transaction.findUnique({
            where: { code },
            include: {
                offer: true,
                user: { select: { name: true } },
            },
        });
        if (!tx)
            throw new common_1.NotFoundException('Código não encontrado');
        if (tx.partnerId !== partnerId)
            throw new common_1.ForbiddenException('Código de outro parceiro');
        if (tx.status === 'VALIDATED')
            throw new common_1.BadRequestException('Código já utilizado');
        if (tx.status === 'EXPIRED' || tx.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Código expirado');
        }
        await this.prisma.transaction.update({
            where: { id: tx.id },
            data: { status: 'VALIDATED', validatedAt: new Date() },
        });
        await this.prisma.user.update({
            where: { id: tx.userId },
            data: { totalSavings: { increment: Number(tx.savingsAmount) } },
        });
        await this.audit.log({
            action: 'transaction.validated',
            entity: 'Transaction',
            entityId: tx.id,
        });
        return {
            valid: true,
            customer: tx.user.name,
            offer: tx.offer.title,
            discount: tx.discount,
            finalAmount: Number(tx.finalAmount),
            savingsAmount: Number(tx.savingsAmount),
            validatedAt: new Date().toISOString(),
        };
    }
    safePartner(partner) {
        const { passwordHash, apiKeyHash, ...safe } = partner;
        return safe;
    }
};
exports.PartnersService = PartnersService;
exports.PartnersService = PartnersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crypto_service_1.CryptoService,
        audit_service_1.AuditService])
], PartnersService);
//# sourceMappingURL=partners.service.js.map