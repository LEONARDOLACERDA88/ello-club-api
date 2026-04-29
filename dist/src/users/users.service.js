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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_service_1 = require("../common/crypto/crypto.service");
const audit_service_1 = require("../audit/audit.service");
const bcrypt = __importStar(require("bcrypt"));
let UsersService = class UsersService {
    prisma;
    crypto;
    audit;
    constructor(prisma, crypto, audit) {
        this.prisma = prisma;
        this.crypto = crypto;
        this.audit = audit;
    }
    async register(dto) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (exists)
            throw new common_1.ConflictException('E-mail já cadastrado');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const cpfEncrypted = dto.cpf ? this.crypto.encrypt(dto.cpf) : undefined;
        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                email: dto.email,
                passwordHash,
                phone: dto.phone,
                cpfEncrypted,
                lgpdConsentAt: new Date(),
                lgpdConsentIp: dto.lgpdConsentIp,
                lgpdConsentVersion: dto.lgpdConsentVersion,
                marketingConsent: dto.marketingConsent ?? false,
            },
        });
        await this.audit.log({
            userId: user.id,
            action: 'user.registered',
            ipAddress: dto.lgpdConsentIp,
        });
        return this.safeUser(user);
    }
    async getProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: { favorites: { select: { offerId: true } } },
        });
        if (!user || user.deletedAt)
            throw new common_1.NotFoundException('Usuário não encontrado');
        return {
            ...this.safeUser(user),
            favorites: user.favorites.map(f => f.offerId),
        };
    }
    async getEconometro(userId) {
        const result = await this.prisma.transaction.aggregate({
            where: { userId, status: 'VALIDATED' },
            _sum: { savingsAmount: true },
            _count: true,
        });
        const totalSavings = Number(result._sum.savingsAmount ?? 0);
        const redemptions = result._count;
        const level = totalSavings >= 1000 ? 'DIAMOND' :
            totalSavings >= 500 ? 'GOLD' :
                totalSavings >= 200 ? 'SILVER' : 'CLASSIC';
        const nextLevel = { CLASSIC: 200, SILVER: 500, GOLD: 1000, DIAMOND: null }[level];
        await this.prisma.user.update({
            where: { id: userId },
            data: { totalSavings, level: level },
        });
        return {
            totalSavings,
            level,
            redemptions,
            nextLevelAt: nextLevel,
            progressPercent: nextLevel
                ? Math.min(100, Math.round((totalSavings / nextLevel) * 100))
                : 100,
        };
    }
    async toggleFavorite(userId, offerId) {
        const existing = await this.prisma.userFavorite.findUnique({
            where: { userId_offerId: { userId, offerId } },
        });
        if (existing) {
            await this.prisma.userFavorite.delete({
                where: { userId_offerId: { userId, offerId } },
            });
        }
        else {
            await this.prisma.userFavorite.create({ data: { userId, offerId } });
        }
        const favorites = await this.prisma.userFavorite.findMany({
            where: { userId },
            select: { offerId: true },
        });
        return { added: !existing, favorites: favorites.map(f => f.offerId) };
    }
    async getPoints(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { points: true, totalSavings: true },
        });
        return {
            points: user?.points ?? 0,
            totalSavings: Number(user?.totalSavings ?? 0),
        };
    }
    async exportData(userId, ip) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                transactions: true,
                favorites: true,
                notifications: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException();
        await this.prisma.lgpdRequest.create({
            data: { userId, type: 'DATA_EXPORT', status: 'processing' },
        });
        await this.audit.log({ userId, action: 'user.lgpd_export', ipAddress: ip });
        const { passwordHash, cpfEncrypted, mfaSecret, ...safeData } = user;
        return {
            exportedAt: new Date().toISOString(),
            data: {
                ...safeData,
                cpf: cpfEncrypted ? '****.***.***-**' : null,
            },
        };
    }
    async deleteAccount(userId, ip) {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                deletedAt: new Date(),
                email: `deleted_${userId}@ello.deleted`,
                name: 'Usuário Removido',
                phone: null,
                cpfEncrypted: null,
                status: 'INACTIVE',
            },
        });
        await this.prisma.refreshToken.updateMany({
            where: { userId },
            data: { revokedAt: new Date() },
        });
        await this.prisma.lgpdRequest.create({
            data: { userId, type: 'DATA_DELETION', status: 'done' },
        });
        await this.audit.log({ userId, action: 'user.account_deleted', ipAddress: ip });
    }
    async getHistory(userId) {
        const transactions = await this.prisma.transaction.findMany({
            where: { userId },
            include: {
                offer: { select: { title: true, category: true, image: true } },
                partner: { select: { name: true, logo: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return transactions;
    }
    safeUser(user) {
        const { passwordHash, cpfEncrypted, mfaSecret, ...safe } = user;
        return safe;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crypto_service_1.CryptoService,
        audit_service_1.AuditService])
], UsersService);
//# sourceMappingURL=users.service.js.map