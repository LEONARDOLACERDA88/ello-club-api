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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const webpush = __importStar(require("web-push"));
let NotificationsService = NotificationsService_1 = class NotificationsService {
    prisma;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        const email = process.env.VAPID_EMAIL || 'contato@elloclubmais.com.br';
        if (publicKey && privateKey) {
            webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
        }
    }
    getVapidPublicKey() {
        return process.env.VAPID_PUBLIC_KEY || '';
    }
    async subscribe(userId, sub, userAgent) {
        return this.prisma.pushSubscription.upsert({
            where: { endpoint: sub.endpoint },
            create: {
                userId,
                endpoint: sub.endpoint,
                auth: sub.keys.auth,
                p256dh: sub.keys.p256dh,
                userAgent,
            },
            update: {
                userId,
                auth: sub.keys.auth,
                p256dh: sub.keys.p256dh,
                userAgent,
            },
        });
    }
    async unsubscribe(userId, endpoint) {
        await this.prisma.pushSubscription.deleteMany({
            where: { userId, endpoint },
        });
    }
    async sendToUser(userId, payload) {
        const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
        const pushPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url || '/home',
            icon: payload.icon || '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
        });
        await Promise.allSettled(subs.map(sub => webpush
            .sendNotification({ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } }, pushPayload)
            .catch(async (err) => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => { });
            }
            this.logger.warn(`Push falhou para sub ${sub.id}: ${err.message}`);
        })));
        await this.prisma.notification.create({
            data: {
                userId,
                title: payload.title,
                body: payload.body,
                type: 'push',
                data: { url: payload.url || '/home' },
            },
        });
    }
    async broadcast(payload, targetLevel) {
        const users = await this.prisma.user.findMany({
            where: {
                status: 'ACTIVE',
                deletedAt: null,
                ...(targetLevel ? { level: targetLevel } : {}),
            },
            select: { id: true },
        });
        let sent = 0;
        for (const u of users) {
            await this.sendToUser(u.id, payload).catch(() => { });
            sent++;
        }
        return { sent };
    }
    async list(userId) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 30,
        });
    }
    async unreadCount(userId) {
        return this.prisma.notification.count({ where: { userId, read: false } });
    }
    async markRead(userId, notificationId) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { read: true },
        });
    }
    async markAllRead(userId) {
        return this.prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map