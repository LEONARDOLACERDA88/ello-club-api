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
exports.ClubeCertoController = void 0;
const common_1 = require("@nestjs/common");
const clube_certo_service_1 = require("./clube-certo.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let ClubeCertoController = class ClubeCertoController {
    svc;
    constructor(svc) {
        this.svc = svc;
    }
    sync() {
        return this.svc.syncAll();
    }
    stats() {
        return this.svc.getStats();
    }
    listAdmin(source, category, status, search) {
        return this.svc.listForAdmin({ source, category, status, search });
    }
    toggle(id) {
        return this.svc.toggleStatus(id);
    }
    getLink(id, user) {
        const cpf = user.cpf || '00000000000';
        return this.svc.getPersonalizedLink(id, cpf).then(url => ({ url }));
    }
    listPublic(category, source) {
        return this.svc.listForAdmin({
            source: source || undefined,
            category,
            status: 'active',
        });
    }
    getCategories() {
        return this.svc.getCategories();
    }
    searchEstablishments(cityId, categoryId, search, page) {
        return this.svc.searchEstablishments({
            cityId: cityId ? Number(cityId) : undefined,
            categoryId: categoryId ? Number(categoryId) : undefined,
            search,
            page: page ? Number(page) : undefined,
        });
    }
    getEstablishment(id) {
        return this.svc.getEstablishmentDetail(Number(id));
    }
    getStates() { return this.svc.getStates(); }
    getCities(stateId) {
        return this.svc.getCities(Number(stateId));
    }
    getCashbackWallet(user) {
        const cpf = user.cpf || '';
        if (!cpf)
            return { error: 'CPF não cadastrado' };
        return { url: this.svc.getCashbackWalletUrl(cpf) };
    }
    registerUser(body) {
        return this.svc.registerUser(body);
    }
};
exports.ClubeCertoController = ClubeCertoController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('sync'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "sync", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "stats", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('admin/list'),
    __param(0, (0, common_1.Query)('source')),
    __param(1, (0, common_1.Query)('category')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "listAdmin", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Patch)('toggle/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "toggle", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('link/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "getLink", null);
__decorate([
    (0, common_1.Get)('partners'),
    __param(0, (0, common_1.Query)('category')),
    __param(1, (0, common_1.Query)('source')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "listPublic", null);
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('establishments'),
    __param(0, (0, common_1.Query)('cityId')),
    __param(1, (0, common_1.Query)('categoryId')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "searchEstablishments", null);
__decorate([
    (0, common_1.Get)('establishments/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "getEstablishment", null);
__decorate([
    (0, common_1.Get)('states'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "getStates", null);
__decorate([
    (0, common_1.Get)('states/:stateId/cities'),
    __param(0, (0, common_1.Param)('stateId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "getCities", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('cashback-wallet'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "getCashbackWallet", null);
__decorate([
    (0, common_1.Post)('register-user'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ClubeCertoController.prototype, "registerUser", null);
exports.ClubeCertoController = ClubeCertoController = __decorate([
    (0, common_1.Controller)('api/clube-certo'),
    __metadata("design:paramtypes", [clube_certo_service_1.ClubeCertoService])
], ClubeCertoController);
//# sourceMappingURL=clube-certo.controller.js.map