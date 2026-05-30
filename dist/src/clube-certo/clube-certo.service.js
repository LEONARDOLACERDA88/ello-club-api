"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ClubeCertoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClubeCertoService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const BASE_URL = process.env.CLUBE_CERTO_BASE_URL || 'https://node.clubecerto.com.br/superapp';
const COMPANY_ID = process.env.CLUBE_CERTO_COMPANY_ID || '1735';
const CAT_MAP = {
    'Gastronomia': 'Gastronomia',
    'Saúde': 'Saúde',
    'Educação': 'Educação',
    'Beleza e Estética': 'Beleza',
    'Moda': 'Moda',
    'Turismo': 'Viagem',
    'Delivery': 'Gastronomia',
    'Hospedagem': 'Hotelaria',
    'Automotivo': 'Outros',
    'Comércio': 'Outros',
    'Serviços': 'Outros',
    'Loja virtual': 'Outros',
    'Pets': 'Pets',
    'Fitness': 'Esporte',
    'Lazer': 'Entretenimento',
    'Cinema': 'Entretenimento',
    'Posto de Combustível': 'Outros',
    'Café': 'Gastronomia',
};
let ClubeCertoService = ClubeCertoService_1 = class ClubeCertoService {
    prisma;
    logger = new common_1.Logger(ClubeCertoService_1.name);
    companyToken = null;
    tokenExpiresAt = 0;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onModuleInit() {
        const exec = (sql) => this.prisma.$executeRawUnsafe(sql);
        try {
            await exec(`DO $$ BEGIN CREATE TYPE "IntegrationType" AS ENUM ('AFFILIATE','API_DIRECT','WIDGET','QR_VOUCHER','POSTBACK'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
            await exec(`CREATE TABLE IF NOT EXISTS "external_partners" ("id" TEXT NOT NULL,"name" TEXT NOT NULL,"category" TEXT NOT NULL,"description" TEXT,"logo" TEXT,"image" TEXT,"discount" INTEGER NOT NULL DEFAULT 0,"integrationType" "IntegrationType" NOT NULL DEFAULT 'AFFILIATE',"affiliateUrl" TEXT,"apiEndpoint" TEXT,"apiKey" TEXT,"widgetUrl" TEXT,"voucherCode" TEXT,"webhookSecret" TEXT,"source" TEXT DEFAULT 'manual',"externalId" TEXT,"clickCount" INTEGER NOT NULL DEFAULT 0,"conversionCount" INTEGER NOT NULL DEFAULT 0,"totalSavings" DECIMAL(10,2) NOT NULL DEFAULT 0,"status" TEXT NOT NULL DEFAULT 'active',"featured" BOOLEAN NOT NULL DEFAULT false,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "external_partners_pkey" PRIMARY KEY ("id"))`);
            await exec(`CREATE TABLE IF NOT EXISTS "external_clicks" ("id" TEXT NOT NULL,"externalPartnerId" TEXT NOT NULL,"userId" TEXT,"sessionId" TEXT,"savingsAmount" DECIMAL(10,2),"converted" BOOLEAN NOT NULL DEFAULT false,"convertedAt" TIMESTAMP(3),"ipAddress" TEXT,"userAgent" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "external_clicks_pkey" PRIMARY KEY ("id"))`);
            await exec(`DROP INDEX IF EXISTS "external_partners_externalId_source_key"`);
            await exec(`DO $$ BEGIN ALTER TABLE "external_partners" ADD CONSTRAINT "external_partners_externalId_source_key" UNIQUE ("externalId","source"); EXCEPTION WHEN duplicate_object THEN null; END $$`);
            await exec(`CREATE INDEX IF NOT EXISTS "external_partners_status_idx" ON "external_partners"("status")`);
            await exec(`CREATE INDEX IF NOT EXISTS "external_partners_source_idx" ON "external_partners"("source")`);
            this.logger.log('Tabelas external_partners e external_clicks verificadas/criadas');
        }
        catch (err) {
            this.logger.error('Erro ao criar tabelas Clube Certo:', err.message);
        }
    }
    async getCompanyToken() {
        if (this.companyToken && Date.now() < this.tokenExpiresAt) {
            return this.companyToken;
        }
        const cnpj = process.env.CLUBE_CERTO_CNPJ?.replace(/\D/g, '') || '';
        const password = process.env.CLUBE_CERTO_PASSWORD || '';
        const res = await fetch(`${BASE_URL}/companyAPI/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpj, password }),
        });
        if (!res.ok)
            throw new Error(`Clube Certo login falhou: ${res.status}`);
        const data = await res.json();
        this.companyToken = data.token;
        this.tokenExpiresAt = Date.now() + 55 * 60 * 1000;
        return this.companyToken;
    }
    async getUserToken(cpf) {
        const companyToken = await this.getCompanyToken();
        const cleanCpf = cpf.replace(/\D/g, '');
        const res = await fetch(`${BASE_URL}/companyAPI/associate/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${companyToken}`,
            },
            body: JSON.stringify({ cpf: cleanCpf }),
        });
        if (!res.ok)
            throw new Error(`Token de usuário Clube Certo falhou: ${res.status}`);
        const data = await res.json();
        return data.token;
    }
    async syncAll() {
        this.logger.log('Iniciando sync Clube Certo...');
        try {
            const token = await this.getCompanyToken();
            const userToken = await this.getUserTokenForSync(token);
            const [discountCount, cashbackCount] = await Promise.all([
                this.syncDiscounts(userToken),
                this.syncCashback(userToken),
            ]);
            this.logger.log(`Sync concluído: ${discountCount} descontos, ${cashbackCount} cashback`);
            return { discounts: discountCount, cashback: cashbackCount, syncedAt: new Date() };
        }
        catch (err) {
            this.logger.error('Erro no sync Clube Certo:', err);
            throw err;
        }
    }
    async getUserTokenForSync(companyToken) {
        const testCpf = process.env.CLUBE_CERTO_TEST_CPF || '00000000001';
        const res = await fetch(`${BASE_URL}/companyAPI/associate/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${companyToken}`,
            },
            body: JSON.stringify({ cpf: testCpf }),
        });
        const data = await res.json();
        return data.token;
    }
    async syncDiscounts(userToken) {
        const res = await fetch(`${BASE_URL}/companyAPI/establishment/search`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
            return 0;
        const establishments = await res.json();
        let count = 0;
        for (const est of establishments) {
            const category = CAT_MAP[est.category?.name] || 'Outros';
            const discountNum = parseInt((est.discount || '0').replace('%', '')) || 0;
            const affiliateUrl = est.discountLink || est.store || null;
            if (!affiliateUrl)
                continue;
            await this.prisma.externalPartner.upsert({
                where: {
                    externalId_source: {
                        externalId: String(est.id),
                        source: 'clube_certo',
                    },
                },
                create: {
                    name: est.name,
                    category,
                    description: null,
                    logo: est.brand || null,
                    image: est.capa || est.brand || null,
                    discount: discountNum,
                    integrationType: 'AFFILIATE',
                    affiliateUrl,
                    source: 'clube_certo',
                    externalId: String(est.id),
                    status: 'active',
                    featured: false,
                    sortOrder: est.underHighlight || 0,
                },
                update: {
                    name: est.name,
                    category,
                    logo: est.brand || null,
                    image: est.capa || est.brand || null,
                    discount: discountNum,
                    affiliateUrl,
                    sortOrder: est.underHighlight || 0,
                    updatedAt: new Date(),
                },
            });
            count++;
        }
        return count;
    }
    async syncCashback(userToken) {
        const res = await fetch(`${BASE_URL}/companyAPI/cashback`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
            return 0;
        const cashbacks = await res.json();
        let count = 0;
        for (const cb of cashbacks) {
            if (!cb.visible || cb.status !== 'Active')
                continue;
            const category = CAT_MAP[cb.categoryId] || 'Outros';
            const affiliateUrl = cb.link || null;
            if (!affiliateUrl)
                continue;
            const discountNum = cb.max ? Math.round(parseFloat(cb.max)) : 0;
            await this.prisma.externalPartner.upsert({
                where: {
                    externalId_source: {
                        externalId: `cb_${cb.id}`,
                        source: 'clube_certo_cashback',
                    },
                },
                create: {
                    name: cb.name,
                    category,
                    description: cb.description || null,
                    logo: null,
                    image: null,
                    discount: discountNum,
                    integrationType: 'AFFILIATE',
                    affiliateUrl,
                    source: 'clube_certo_cashback',
                    externalId: `cb_${cb.id}`,
                    status: 'active',
                    featured: false,
                    sortOrder: 0,
                },
                update: {
                    name: cb.name,
                    category,
                    description: cb.description || null,
                    discount: discountNum,
                    affiliateUrl,
                    updatedAt: new Date(),
                },
            });
            count++;
        }
        return count;
    }
    async getPersonalizedLink(partnerId, userCpf) {
        const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } });
        if (!partner?.affiliateUrl)
            throw new Error('Parceiro não encontrado');
        const cleanCpf = userCpf.replace(/\D/g, '');
        return partner.affiliateUrl.replace('00000000001', cleanCpf);
    }
    async getStats() {
        const [discounts, cashback] = await Promise.all([
            this.prisma.externalPartner.count({ where: { source: 'clube_certo' } }),
            this.prisma.externalPartner.count({ where: { source: 'clube_certo_cashback' } }),
        ]);
        const active = await this.prisma.externalPartner.count({
            where: { source: { in: ['clube_certo', 'clube_certo_cashback'] }, status: 'active' },
        });
        const inactive = await this.prisma.externalPartner.count({
            where: { source: { in: ['clube_certo', 'clube_certo_cashback'] }, status: 'inactive' },
        });
        return { discounts, cashback, total: discounts + cashback, active, inactive };
    }
    async registerUser(data) {
        try {
            const token = await this.getCompanyToken();
            const cleanCpf = data.cpf.replace(/\D/g, '');
            const body = {
                name: data.name,
                cpf: cleanCpf,
                discount: true,
                cashback: true,
            };
            if (data.email)
                body.email = data.email;
            if (data.birthDate)
                body.birthDate = data.birthDate;
            if (data.phone)
                body.phone = data.phone.replace(/\D/g, '');
            const res = await fetch(`${BASE_URL}/companyAPI/associate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                this.logger.warn(`Clube Certo registerUser falhou para ${cleanCpf}: ${err?.error}`);
                return { success: false, error: err?.error || `HTTP ${res.status}` };
            }
            this.logger.log(`Usuário ${cleanCpf} registrado no Clube Certo`);
            return { success: true };
        }
        catch (err) {
            this.logger.error('Erro ao registrar usuário no Clube Certo:', err.message);
            return { success: false, error: err.message };
        }
    }
    async getCategories() {
        const userToken = await this.getUserTokenForSync(await this.getCompanyToken());
        const res = await fetch(`${BASE_URL}/companyAPI/establishment/categories`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
            return [];
        return res.json();
    }
    async searchEstablishments(params) {
        const userToken = await this.getUserTokenForSync(await this.getCompanyToken());
        const qs = new URLSearchParams();
        if (params.cityId)
            qs.set('cityId', String(params.cityId));
        if (params.categoryId)
            qs.set('categoryId', String(params.categoryId));
        if (params.search)
            qs.set('name', params.search);
        if (params.page)
            qs.set('page', String(params.page));
        const res = await fetch(`${BASE_URL}/companyAPI/establishment/search?${qs}`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
            return { establishments: [], total: 0 };
        const data = await res.json();
        return Array.isArray(data) ? { establishments: data, total: data.length } : data;
    }
    async getStates() {
        const userToken = await this.getUserTokenForSync(await this.getCompanyToken());
        const res = await fetch(`${BASE_URL}/locations/states`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
            return [];
        return res.json();
    }
    async getCities(stateId) {
        const userToken = await this.getUserTokenForSync(await this.getCompanyToken());
        const res = await fetch(`${BASE_URL}/locations/cities/${stateId}`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
            return [];
        return res.json();
    }
    getCashbackWalletUrl(cpf) {
        const cleanCpf = cpf.replace(/\D/g, '');
        return `${BASE_URL.replace('node.clubecerto.com.br/superapp', 'integrations.clubecerto.com.br')}/webapp/${cleanCpf}/${COMPANY_ID}`;
    }
    async getEstablishmentDetail(id) {
        const userToken = await this.getUserTokenForSync(await this.getCompanyToken());
        const res = await fetch(`${BASE_URL}/companyAPI/establishment/${id}`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        if (!res.ok)
            return null;
        return res.json();
    }
    async toggleStatus(partnerId) {
        const partner = await this.prisma.externalPartner.findUnique({ where: { id: partnerId } });
        if (!partner)
            throw new Error('Parceiro não encontrado');
        const newStatus = partner.status === 'active' ? 'inactive' : 'active';
        await this.prisma.externalPartner.update({
            where: { id: partnerId },
            data: { status: newStatus },
        });
        return { status: newStatus };
    }
    async listForAdmin(params) {
        const where = {
            source: params.source
                ? params.source
                : { in: ['clube_certo', 'clube_certo_cashback'] },
        };
        if (params.category)
            where.category = params.category;
        if (params.status)
            where.status = params.status;
        if (params.search)
            where.name = { contains: params.search, mode: 'insensitive' };
        const partners = await this.prisma.externalPartner.findMany({
            where,
            orderBy: [{ status: 'asc' }, { sortOrder: 'desc' }, { name: 'asc' }],
            select: {
                id: true, name: true, category: true, logo: true, image: true,
                discount: true, source: true, status: true, featured: true,
                clickCount: true, conversionCount: true, externalId: true,
            },
        });
        return { partners, total: partners.length };
    }
};
exports.ClubeCertoService = ClubeCertoService;
__decorate([
    (0, schedule_1.Cron)('0 5 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ClubeCertoService.prototype, "syncAll", null);
exports.ClubeCertoService = ClubeCertoService = ClubeCertoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClubeCertoService);
//# sourceMappingURL=clube-certo.service.js.map