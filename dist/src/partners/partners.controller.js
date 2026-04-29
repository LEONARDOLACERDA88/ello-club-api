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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnersController = void 0;
const common_1 = require("@nestjs/common");
const partners_service_1 = require("./partners.service");
const register_partner_dto_1 = require("./dto/register-partner.dto");
const create_offer_dto_1 = require("./dto/create-offer.dto");
const create_webhook_dto_1 = require("./dto/create-webhook.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let PartnersController = class PartnersController {
    partners;
    constructor(partners) {
        this.partners = partners;
    }
    register(dto, req) {
        return this.partners.register(dto, req.ip);
    }
    getProfile(partnerId) {
        return this.partners.getProfile(partnerId);
    }
    getDashboard(partnerId) {
        return this.partners.getDashboard(partnerId);
    }
    getOffers(partnerId) {
        return this.partners.getOffers(partnerId);
    }
    createOffer(partnerId, dto) {
        return this.partners.createOffer(partnerId, dto);
    }
    updateOffer(partnerId, offerId, dto) {
        return this.partners.updateOffer(partnerId, offerId, dto);
    }
    deleteOffer(partnerId, offerId) {
        return this.partners.deleteOffer(partnerId, offerId);
    }
    generateApiKey(partnerId) {
        return this.partners.generateApiKey(partnerId);
    }
    revokeApiKey(partnerId) {
        return this.partners.revokeApiKey(partnerId);
    }
    getWebhooks(partnerId) {
        return this.partners.getWebhooks(partnerId);
    }
    createWebhook(partnerId, dto) {
        return this.partners.createWebhook(partnerId, dto);
    }
    deleteWebhook(partnerId, webhookId) {
        return this.partners.deleteWebhook(partnerId, webhookId);
    }
    getTransactions(partnerId) {
        return this.partners.getTransactions(partnerId);
    }
    validateCode(partnerId, code) {
        return this.partners.validateCode(partnerId, code);
    }
};
exports.PartnersController = PartnersController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_partner_dto_1.RegisterPartnerDto, Object]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('offers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getOffers", null);
__decorate([
    (0, common_1.Post)('offers'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_offer_dto_1.CreateOfferDto]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "createOffer", null);
__decorate([
    (0, common_1.Put)('offers/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "updateOffer", null);
__decorate([
    (0, common_1.Delete)('offers/:id'),
    (0, common_1.HttpCode)(204),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "deleteOffer", null);
__decorate([
    (0, common_1.Post)('api-key/generate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "generateApiKey", null);
__decorate([
    (0, common_1.Delete)('api-key/revoke'),
    (0, common_1.HttpCode)(204),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "revokeApiKey", null);
__decorate([
    (0, common_1.Get)('webhooks'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getWebhooks", null);
__decorate([
    (0, common_1.Post)('webhooks'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_webhook_dto_1.CreateWebhookDto]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "createWebhook", null);
__decorate([
    (0, common_1.Delete)('webhooks/:id'),
    (0, common_1.HttpCode)(204),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "deleteWebhook", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "getTransactions", null);
__decorate([
    (0, common_1.Post)('validate/:code'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('partner'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], PartnersController.prototype, "validateCode", null);
exports.PartnersController = PartnersController = __decorate([
    (0, common_1.Controller)('api/partners'),
    __metadata("design:paramtypes", [partners_service_1.PartnersService])
], PartnersController);
//# sourceMappingURL=partners.controller.js.map