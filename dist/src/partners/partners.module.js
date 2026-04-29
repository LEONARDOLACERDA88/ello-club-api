"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartnersModule = void 0;
const common_1 = require("@nestjs/common");
const partners_service_1 = require("./partners.service");
const partners_controller_1 = require("./partners.controller");
const crypto_service_1 = require("../common/crypto/crypto.service");
const audit_service_1 = require("../audit/audit.service");
let PartnersModule = class PartnersModule {
};
exports.PartnersModule = PartnersModule;
exports.PartnersModule = PartnersModule = __decorate([
    (0, common_1.Module)({
        providers: [partners_service_1.PartnersService, crypto_service_1.CryptoService, audit_service_1.AuditService],
        controllers: [partners_controller_1.PartnersController],
        exports: [partners_service_1.PartnersService],
    })
], PartnersModule);
//# sourceMappingURL=partners.module.js.map