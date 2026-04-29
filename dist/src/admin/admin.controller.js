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
exports.AdminSetupController = exports.AdminController = void 0;
const common_1 = require("@nestjs/common");
const admin_service_1 = require("./admin.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let AdminController = class AdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    getDashboard() {
        return this.admin.getDashboard();
    }
    getPartners(status) {
        return this.admin.getPartners(status);
    }
    approvePartner(adminId, partnerId) {
        return this.admin.approvePartner(adminId, partnerId);
    }
    suspendPartner(adminId, partnerId, body) {
        return this.admin.suspendPartner(adminId, partnerId, body.reason);
    }
    getUsers(page) {
        return this.admin.getUsers(page ? parseInt(page) : 1);
    }
    updateUserStatus(adminId, userId, body) {
        return this.admin.updateUserStatus(adminId, userId, body.status);
    }
    getCommissions(status) {
        return this.admin.getCommissions(status);
    }
    payCommissions(adminId, partnerId) {
        return this.admin.payCommissions(adminId, partnerId);
    }
    getReports() {
        return this.admin.getReports();
    }
    getAuditLogs(page) {
        return this.admin.getAuditLogs(page ? parseInt(page) : 1);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('partners'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getPartners", null);
__decorate([
    (0, common_1.Put)('partners/:id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "approvePartner", null);
__decorate([
    (0, common_1.Put)('partners/:id/suspend'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "suspendPartner", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Put)('users/:id/status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateUserStatus", null);
__decorate([
    (0, common_1.Get)('commissions'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getCommissions", null);
__decorate([
    (0, common_1.Post)('commissions/pay/:partnerId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)('id')),
    __param(1, (0, common_1.Param)('partnerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "payCommissions", null);
__decorate([
    (0, common_1.Get)('reports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getReports", null);
__decorate([
    (0, common_1.Get)('audit-logs'),
    __param(0, (0, common_1.Query)('page')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getAuditLogs", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.Controller)('api/admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, current_user_decorator_1.RequireType)('admin'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminController);
const common_2 = require("@nestjs/common");
let AdminSetupController = class AdminSetupController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    setup(body) {
        if (body.setupSecret !== process.env.ADMIN_SETUP_SECRET) {
            throw new Error('Setup secret inválido');
        }
        return this.admin.createFirstAdmin(body.email, body.password, body.name);
    }
};
exports.AdminSetupController = AdminSetupController;
__decorate([
    (0, common_2.Post)(),
    (0, common_1.HttpCode)(201),
    __param(0, (0, common_2.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdminSetupController.prototype, "setup", null);
exports.AdminSetupController = AdminSetupController = __decorate([
    (0, common_2.Controller)('api/admin/setup'),
    __metadata("design:paramtypes", [admin_service_1.AdminService])
], AdminSetupController);
//# sourceMappingURL=admin.controller.js.map