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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AsaasController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsaasController = void 0;
const common_1 = require("@nestjs/common");
const asaas_service_1 = require("./asaas.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let AsaasController = AsaasController_1 = class AsaasController {
    svc;
    logger = new common_1.Logger(AsaasController_1.name);
    constructor(svc) {
        this.svc = svc;
    }
    async subscribe(user, body) {
        const customerId = await this.svc.upsertCustomer({
            userId: user.id,
            name: user.name,
            email: user.email,
            cpf: body.cpf,
            phone: body.phone,
        });
        const result = await this.svc.createSubscription({
            userId: user.id,
            customerId,
            planKey: body.planKey,
            billingType: body.billingType,
        });
        await this.svc.trackLeadEvent({
            userId: user.id,
            email: user.email,
            name: user.name,
            event: 'selected_plan',
            planKey: body.planKey,
        });
        return result;
    }
    async trackLead(user, body) {
        await this.svc.trackLeadEvent({
            userId: user.id,
            email: user.email,
            name: user.name,
            event: body.event,
            planKey: body.planKey,
        });
        return { ok: true };
    }
    async webhook(token, body, req) {
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        if (expected && token !== expected) {
            this.logger.warn(`Webhook Asaas com token inválido: ${token}`);
            throw new common_1.UnauthorizedException('Token inválido');
        }
        const event = body.event;
        const payment = body.payment;
        if (!event || !payment)
            return { ok: true };
        setImmediate(() => {
            this.svc.processWebhook(event, payment).catch(err => this.logger.error(`Erro processando webhook ${event}:`, err));
        });
        return { ok: true };
    }
    getStats() {
        return this.svc.getStats();
    }
};
exports.AsaasController = AsaasController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('subscribe'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AsaasController.prototype, "subscribe", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('track-lead'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AsaasController.prototype, "trackLead", null);
__decorate([
    (0, common_1.Post)('webhook'),
    __param(0, (0, common_1.Headers)('asaas-access-token')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AsaasController.prototype, "webhook", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AsaasController.prototype, "getStats", null);
exports.AsaasController = AsaasController = AsaasController_1 = __decorate([
    (0, common_1.Controller)('api/asaas'),
    __metadata("design:paramtypes", [asaas_service_1.AsaasService])
], AsaasController);
//# sourceMappingURL=asaas.controller.js.map