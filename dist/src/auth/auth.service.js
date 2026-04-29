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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let AuthService = class AuthService {
    prisma;
    jwt;
    config;
    audit;
    constructor(prisma, jwt, config, audit) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.audit = audit;
    }
    async loginUser(email, password, ip, ua) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || user.deletedAt)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        if (user.status === 'SUSPENDED')
            throw new common_1.ForbiddenException('Conta suspensa');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        await this.audit.log({ userId: user.id, action: 'user.login', ipAddress: ip, userAgent: ua });
        const tokens = await this.generateTokens(user.id, 'user');
        return { tokens, user: this.safeUser(user) };
    }
    async loginPartner(email, password, ip, ua) {
        const partner = await this.prisma.partner.findUnique({ where: { email } });
        if (!partner)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        if (partner.status === 'SUSPENDED')
            throw new common_1.ForbiddenException('Conta suspensa');
        const valid = await bcrypt.compare(password, partner.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        await this.audit.log({ action: 'partner.login', entityId: partner.id, ipAddress: ip, userAgent: ua });
        const tokens = await this.generateTokens(partner.id, 'partner');
        return { tokens, partner: this.safePartner(partner) };
    }
    async loginAdmin(email, password, ip) {
        const admin = await this.prisma.admin.findUnique({ where: { email } });
        if (!admin)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        const valid = await bcrypt.compare(password, admin.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Credenciais inválidas');
        await this.audit.log({ action: 'admin.login', entityId: admin.id, ipAddress: ip });
        const tokens = await this.generateTokens(admin.id, 'admin');
        return { tokens, admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } };
    }
    async refreshTokens(refreshToken, ip) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const stored = await this.prisma.refreshToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Refresh token inválido ou expirado');
        }
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
        });
        const tokens = await this.generateTokens(stored.userId, 'user');
        await this.audit.log({ userId: stored.userId, action: 'user.token_refresh', ipAddress: ip });
        return tokens;
    }
    async logout(refreshToken) {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        await this.prisma.refreshToken.updateMany({
            where: { tokenHash },
            data: { revokedAt: new Date() },
        });
    }
    async generateTokens(subjectId, type) {
        const accessToken = this.jwt.sign({ sub: subjectId, type });
        const rawRefresh = crypto.randomBytes(64).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        if (type === 'user') {
            await this.prisma.refreshToken.create({
                data: { userId: subjectId, tokenHash, expiresAt },
            });
        }
        return { accessToken, refreshToken: rawRefresh, expiresIn: 900 };
    }
    safeUser(user) {
        const { passwordHash, cpfEncrypted, mfaSecret, ...safe } = user;
        return safe;
    }
    safePartner(partner) {
        const { passwordHash, apiKeyHash, ...safe } = partner;
        return safe;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map