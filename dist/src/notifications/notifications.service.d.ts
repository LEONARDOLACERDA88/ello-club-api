import { PrismaService } from '../prisma/prisma.service';
export declare class NotificationsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getVapidPublicKey(): string;
    subscribe(userId: string, sub: {
        endpoint: string;
        keys: {
            auth: string;
            p256dh: string;
        };
    }, userAgent?: string): Promise<any>;
    unsubscribe(userId: string, endpoint: string): Promise<void>;
    sendToUser(userId: string, payload: {
        title: string;
        body: string;
        url?: string;
        icon?: string;
    }): Promise<void>;
    broadcast(payload: {
        title: string;
        body: string;
        url?: string;
    }, targetLevel?: string): Promise<{
        sent: number;
    }>;
    list(userId: string): Promise<any>;
    unreadCount(userId: string): Promise<number>;
    markRead(userId: string, notificationId: string): Promise<any>;
    markAllRead(userId: string): Promise<any>;
}
