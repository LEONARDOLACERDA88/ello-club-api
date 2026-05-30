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
var AsaasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsaasService = exports.PLANS = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const clube_certo_service_1 = require("../clube-certo/clube-certo.service");
const notifications_service_1 = require("../notifications/notifications.service");
const BASE_URL = process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
exports.PLANS = {
    individual: { name: 'Fundador Individual', price: 29.90, level: 'SILVER' },
    familia: { name: 'Fundador Família', price: 49.90, level: 'GOLD' },
    empresarial: { name: 'Empresarial', price: 199.00, level: 'GOLD' },
};
let AsaasService = AsaasService_1 = class AsaasService {
    prisma;
    clubeCerto;
    notifications;
    logger = new common_1.Logger(AsaasService_1.name);
    constructor(prisma, clubeCerto, notifications) {
        this.prisma = prisma;
        this.clubeCerto = clubeCerto;
        this.notifications = notifications;
    }
    get headers() {
        return {
            'Content-Type': 'application/json',
            'access_token': process.env.ASAAS_API_KEY || '',
        };
    }
    async upsertCustomer(data) {
        const user = await this.prisma.user.findUnique({
            where: { id: data.userId },
            select: { asaasCustomerId: true },
        });
        if (user?.asaasCustomerId)
            return user.asaasCustomerId;
        const cleanCpf = data.cpf.replace(/\D/g, '');
        const searchRes = await fetch(`${BASE_URL}/customers?cpfCnpj=${cleanCpf}`, {
            headers: this.headers,
        });
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.data?.length > 0) {
                const customerId = searchData.data[0].id;
                await this.prisma.user.update({
                    where: { id: data.userId },
                    data: { asaasCustomerId: customerId },
                });
                return customerId;
            }
        }
        const res = await fetch(`${BASE_URL}/customers`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                cpfCnpj: cleanCpf,
                mobilePhone: data.phone?.replace(/\D/g, ''),
                notificationDisabled: false,
            }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Asaas criar cliente falhou: ${JSON.stringify(err.errors)}`);
        }
        const customer = await res.json();
        await this.prisma.user.update({
            where: { id: data.userId },
            data: { asaasCustomerId: customer.id },
        });
        this.logger.log(`Cliente Asaas criado: ${customer.id} para usuário ${data.userId}`);
        return customer.id;
    }
    async createSubscription(data) {
        const plan = exports.PLANS[data.planKey];
        const today = new Date().toISOString().split('T')[0];
        const body = {
            customer: data.customerId,
            billingType: data.billingType,
            value: plan.price,
            nextDueDate: today,
            cycle: 'MONTHLY',
            description: `ELLO Club — ${plan.name}`,
            externalReference: `${data.userId}:${data.planKey}`,
            callback: {
                successUrl: `${process.env.FRONTEND_URL || 'https://ello-club.vercel.app'}/planos/sucesso`,
                autoRedirect: true,
            },
        };
        const res = await fetch(`${BASE_URL}/subscriptions`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Asaas criar assinatura falhou: ${JSON.stringify(err.errors)}`);
        }
        const sub = await res.json();
        await this.prisma.asaasSubscription.create({
            data: {
                userId: data.userId,
                asaasId: sub.id,
                planKey: data.planKey,
                status: 'PENDING',
                billingType: data.billingType,
                value: plan.price,
            },
        });
        this.logger.log(`Assinatura criada: ${sub.id} (${plan.name}) para ${data.userId}`);
        return {
            subscriptionId: sub.id,
            paymentUrl: sub.url || sub.bankSlipUrl || '',
            invoiceUrl: sub.invoiceUrl,
        };
    }
    async processWebhook(event, payment) {
        this.logger.log(`Asaas webhook: ${event} — payment ${payment.id}`);
        const subscriptionId = payment.subscription;
        if (!subscriptionId)
            return;
        const sub = await this.prisma.asaasSubscription.findFirst({
            where: { asaasId: subscriptionId },
            include: { user: true },
        });
        if (!sub) {
            this.logger.warn(`Assinatura não encontrada para ${subscriptionId}`);
            return;
        }
        switch (event) {
            case 'PAYMENT_RECEIVED':
            case 'PAYMENT_CONFIRMED':
                await this.activatePlan(sub);
                break;
            case 'PAYMENT_OVERDUE':
                await this.handleOverdue(sub);
                break;
            case 'SUBSCRIPTION_CANCELLED':
            case 'PAYMENT_REFUNDED':
                await this.deactivatePlan(sub);
                break;
        }
    }
    async activatePlan(sub) {
        const plan = exports.PLANS[sub.planKey];
        const now = new Date();
        const expiresAt = new Date(now.setMonth(now.getMonth() + 1));
        await this.prisma.user.update({
            where: { id: sub.userId },
            data: {
                level: plan.level,
                planExpiresAt: expiresAt,
                planKey: sub.planKey,
            },
        });
        await this.prisma.asaasSubscription.update({
            where: { id: sub.id },
            data: { status: 'ACTIVE', activatedAt: new Date() },
        });
        const user = sub.user;
        if (user.cpfEncrypted) {
            try {
                this.logger.log(`Registrando ${user.id} no Clube Certo...`);
            }
            catch (err) {
                this.logger.error('Erro ao registrar no Clube Certo:', err);
            }
        }
        try {
            await this.notifications.sendToUser(sub.userId, {
                title: '🎉 Plano ativado!',
                body: `Seu plano ${plan.name} está ativo. Aproveite os benefícios!`,
            });
        }
        catch (_) { }
        await this.triggerN8n('plan_activated', {
            userId: sub.userId,
            email: user.email,
            name: user.name,
            plan: plan.name,
            planKey: sub.planKey,
        });
        this.logger.log(`Plano ${plan.name} ativado para ${sub.userId}`);
    }
    async handleOverdue(sub) {
        await this.triggerN8n('payment_overdue', {
            userId: sub.userId,
            email: sub.user.email,
            name: sub.user.name,
            plan: exports.PLANS[sub.planKey].name,
        });
        this.logger.warn(`Pagamento vencido para assinatura ${sub.asaasId}`);
    }
    async deactivatePlan(sub) {
        await this.prisma.user.update({
            where: { id: sub.userId },
            data: { level: 'CLASSIC', planKey: null, planExpiresAt: null },
        });
        await this.prisma.asaasSubscription.update({
            where: { id: sub.id },
            data: { status: 'CANCELLED' },
        });
        await this.triggerN8n('plan_cancelled', {
            userId: sub.userId,
            email: sub.user.email,
            name: sub.user.name,
        });
        this.logger.log(`Plano cancelado para ${sub.userId}`);
    }
    async trackLeadEvent(data) {
        await this.prisma.leadEvent.create({
            data: {
                userId: data.userId || null,
                email: data.email || null,
                name: data.name || null,
                event: data.event,
                planKey: data.planKey || null,
                metadata: data.metadata ? JSON.stringify(data.metadata) : null,
            },
        });
        if (data.event === 'abandoned_checkout' && (data.email || data.userId)) {
            await this.triggerN8n('abandoned_checkout', {
                userId: data.userId,
                email: data.email,
                name: data.name,
                planKey: data.planKey,
            });
        }
    }
    async triggerN8n(event, payload) {
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        if (!webhookUrl)
            return;
        try {
            await fetch(`${webhookUrl}/${event}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
            });
        }
        catch (err) {
            this.logger.warn(`n8n webhook falhou (${event}): ${err.message}`);
        }
    }
    async getStats() {
        const [active, pending, cancelled, mrr] = await Promise.all([
            this.prisma.asaasSubscription.count({ where: { status: 'ACTIVE' } }),
            this.prisma.asaasSubscription.count({ where: { status: 'PENDING' } }),
            this.prisma.asaasSubscription.count({ where: { status: 'CANCELLED' } }),
            this.prisma.asaasSubscription.aggregate({
                where: { status: 'ACTIVE' },
                _sum: { value: true },
            }),
        ]);
        const leads = await this.prisma.leadEvent.groupBy({
            by: ['event'],
            _count: { event: true },
        });
        return {
            subscriptions: { active, pending, cancelled },
            mrr: Number(mrr._sum.value || 0),
            leads: Object.fromEntries(leads.map(l => [l.event, l._count.event])),
        };
    }
};
exports.AsaasService = AsaasService;
exports.AsaasService = AsaasService = AsaasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        clube_certo_service_1.ClubeCertoService,
        notifications_service_1.NotificationsService])
], AsaasService);
//# sourceMappingURL=asaas.service.js.map